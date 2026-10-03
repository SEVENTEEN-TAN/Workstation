import { z } from "zod";

export const KNOWLEDGE_GRAPH_MAX_BYTES = 4 * 1024 * 1024;
const idSchema = z.string().regex(/^[a-f0-9]{64}$/);
const categorySchema = z.string().trim().min(1).max(120).refine((value) => !/[\\/\r\n]/.test(value) && value !== "." && value !== "..", "分类必须是单层名称");

export const knowledgeGraphSchema = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime(),
  nodes: z.array(z.object({
    id: idSchema,
    title: z.string().trim().min(1).max(240),
    category: categorySchema,
  }).strict()).min(1).max(2_000),
  edges: z.array(z.object({ source: idSchema, target: idSchema }).strict()).max(20_000),
}).strict().superRefine((graph, context) => {
  const ids = new Set(graph.nodes.map((node) => node.id));
  if (ids.size !== graph.nodes.length) context.addIssue({ code: "custom", message: "笔记标识不能重复", path: ["nodes"] });
  const edges = new Set<string>();
  for (const edge of graph.edges) {
    const key = `${edge.source}:${edge.target}`;
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) context.addIssue({ code: "custom", message: "连线必须指向不同的现有笔记", path: ["edges"] });
    if (edges.has(key)) context.addIssue({ code: "custom", message: "连线不能重复", path: ["edges"] });
    edges.add(key);
  }
});

export type KnowledgeGraph = z.output<typeof knowledgeGraphSchema>;
export const knowledgeGraphPublishSchema = z.object({
  revisionId: z.uuid(),
  categories: z.array(categorySchema).min(1).max(200).refine((values) => new Set(values).size === values.length, "分类不能重复"),
}).strict();

export function selectKnowledgeGraphCategories(graph: KnowledgeGraph, categories: readonly string[]): KnowledgeGraph {
  const selected = new Set(categories);
  const known = new Set(graph.nodes.map((node) => node.category));
  if (!selected.size || [...selected].some((category) => !known.has(category))) throw new Error("请选择图谱中已有的公开分类");
  const nodes = graph.nodes.filter((node) => selected.has(node.category));
  const ids = new Set(nodes.map((node) => node.id));
  return { ...graph, nodes, edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) };
}

export async function readKnowledgeGraphJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > KNOWLEDGE_GRAPH_MAX_BYTES) throw new Response(JSON.stringify({ error: "图谱文件不能超过 4 MiB" }), { status: 413, headers: { "content-type": "application/json" } });
  const reader = request.body?.getReader();
  if (!reader) throw new Error("请选择有效的图谱 JSON 文件");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > KNOWLEDGE_GRAPH_MAX_BYTES) {
        await reader.cancel();
        throw new Response(JSON.stringify({ error: "图谱文件不能超过 4 MiB" }), { status: 413, headers: { "content-type": "application/json" } });
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(data)); }
  catch { throw new Error("请求体必须是有效的图谱 JSON"); }
}
