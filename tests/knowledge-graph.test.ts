import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { KNOWLEDGE_GRAPH_MAX_BYTES, knowledgeGraphSchema, readKnowledgeGraphJson } from "../src/lib/knowledge/graph-contract";
import { exportKnowledgeGraph } from "../src/lib/knowledge/graph-export";
import { createKnowledgeGraphService, type KnowledgeGraphRepository, type KnowledgeGraphState } from "../src/lib/services/knowledge-graph";

const graph = {
  version: 1 as const, generatedAt: "2026-10-03T00:00:00.000Z",
  nodes: [{ id: "a".repeat(64), title: "Java", category: "Java" }, { id: "b".repeat(64), title: "AI", category: "AI" }],
  edges: [{ source: "a".repeat(64), target: "b".repeat(64) }],
};

describe("graph-only contract", () => {
  it("rejects private payload fields instead of silently accepting them", () => {
    expect(() => knowledgeGraphSchema.parse({ ...graph, markdown: "secret" })).toThrow();
    expect(() => knowledgeGraphSchema.parse({ ...graph, nodes: [{ ...graph.nodes[0], relativePath: "private.md" }] })).toThrow();
    expect(knowledgeGraphSchema.parse(graph)).toEqual(graph);
  });
  it("rejects duplicate identities, dangling edges and repeated edges", () => {
    expect(() => knowledgeGraphSchema.parse({ ...graph, nodes: [graph.nodes[0], graph.nodes[0]] })).toThrow();
    expect(() => knowledgeGraphSchema.parse({ ...graph, edges: [{ source: "c".repeat(64), target: graph.nodes[0].id }] })).toThrow();
    expect(() => knowledgeGraphSchema.parse({ ...graph, edges: [graph.edges[0], graph.edges[0]] })).toThrow();
  });
  it("caps request bodies even without a content-length header", async () => {
    const request = new Request("http://localhost/graph", { method: "POST", body: " ".repeat(KNOWLEDGE_GRAPH_MAX_BYTES + 1) });
    await expect(readKnowledgeGraphJson(request)).rejects.toMatchObject({ status: 413 });
    await expect(readKnowledgeGraphJson(new Request("http://localhost/graph", { method: "POST", body: JSON.stringify(graph) }))).resolves.toEqual(graph);
  });
});

describe("readonly graph export", () => {
  let root: string;
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }); });
  it("exports only note relationships, ignores hidden/tool/private folders, code and attachments", async () => {
    root = await mkdtemp(join(tmpdir(), "graph-export-"));
    for (const dir of ["Java", "AI", "other", ".hidden", "Temp", "Skill"]) await mkdir(join(root, dir));
    await writeFile(join(root, "Java", "Entry.md"), [
      "---", "secret: do-not-export", "---", "[[AI/Model#Missing heading|label]]", "[[alias]]", "![[AI/Model]]", "[model](../AI/Model.md#part)",
      "[[Duplicate]]", "[[Missing]]", "![[photo.png]]", "```md", "[[other/Fake]]", "```", "`[[other/Fake]]`", "<!-- [[other/Fake]] -->", "PRIVATE BODY",
    ].join("\n"));
    await writeFile(join(root, "AI", "Model.md"), "---\naliases: [alias]\n---\n# Model");
    for (const name of ["Java/Duplicate.md", "AI/Duplicate.md", "other/Fake.md", ".hidden/Hidden.md", "Temp/Temp.md", "Skill/Skill.md"]) await writeFile(join(root, name), "secret");
    await writeFile(join(root, "photo.png"), "IMAGE SECRET");
    const result = await exportKnowledgeGraph(root);
    expect(result.graph.nodes).toHaveLength(5);
    const entry = result.graph.nodes.find((node) => node.title === "Entry")!;
    const model = result.graph.nodes.find((node) => node.title === "Model")!;
    // The source-directory duplicate wins, rather than choosing another directory arbitrarily.
    const duplicate = result.graph.nodes.find((node) => node.title === "Duplicate" && node.category === "Java")!;
    expect(result.graph.edges).toEqual(expect.arrayContaining([{ source: entry.id, target: model.id }, { source: entry.id, target: duplicate.id }]));
    expect(result.graph.edges).toHaveLength(2);
    const json = JSON.stringify(result.graph);
    for (const secret of [root, "PRIVATE BODY", "do-not-export", "IMAGE SECRET", "relativePath", "markdown", "aliases", "photo.png"]) expect(json).not.toContain(secret);
    expect(result.diagnostics.unresolvedLinks).toBe(1);
    expect((await exportKnowledgeGraph(root)).graph.nodes).toEqual(result.graph.nodes);
  });
  it("resolves dotted note names while skipping truly ambiguous references", async () => {
    root = await mkdtemp(join(tmpdir(), "graph-export-"));
    for (const dir of ["Java", "AI", "other"]) await mkdir(join(root, dir));
    await writeFile(join(root, "other", "Source.md"), "[[Spring 3.2]]\n[[Duplicate]]\n[[秘密截图.png]]");
    await writeFile(join(root, "Java", "Spring 3.2.md"), "# Spring");
    await writeFile(join(root, "Java", "Duplicate.md"), "");
    await writeFile(join(root, "AI", "Duplicate.md"), "");
    const result = await exportKnowledgeGraph(root);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.diagnostics).toEqual({ unresolvedLinks: 0, ambiguousLinks: 1 });
  });
});

function memoryRepository() {
  let state: KnowledgeGraphState | null = null;
  const repository: KnowledgeGraphRepository = {
    async read() { return state; },
    async saveDraft(revisionId, value, importedAt) { state = { ...state, revisionId, draft: value, importedAt, published: state?.published ?? null, publishedAt: state?.publishedAt ?? null }; },
    async publish(revisionId, value, publishedAt) {
      if (!state || state.revisionId !== revisionId) return false;
      state = { ...state, published: value, publishedAt }; return true;
    },
  };
  return repository;
}

describe("graph import and publication", () => {
  it("keeps import private, publishes selected categories and retains the publication during later imports", async () => {
    const service = createKnowledgeGraphService(memoryRepository());
    const initial = await service.importGraph(graph);
    expect(initial.draft?.graph).toEqual(graph);
    expect(await service.getPublished()).toBeNull();
    await service.publish({ revisionId: initial.draft!.revisionId, categories: ["Java"] });
    expect(await service.getPublished()).toMatchObject({ nodes: [graph.nodes[0]], edges: [] });
    await service.importGraph({ ...graph, nodes: [{ ...graph.nodes[0], title: "Changed" }], edges: [] });
    expect(await service.getPublished()).toMatchObject({ nodes: [graph.nodes[0]] });
  });
  it("rejects stale revisions and invalid selections without replacing the public snapshot", async () => {
    const service = createKnowledgeGraphService(memoryRepository());
    const initial = await service.importGraph(graph);
    await service.importGraph(graph);
    await expect(service.publish({ revisionId: initial.draft!.revisionId, categories: ["Java"] })).rejects.toThrow("已更新");
    const current = await service.getAdmin();
    await expect(service.publish({ revisionId: current.draft!.revisionId, categories: ["Unknown"] })).rejects.toThrow();
    await expect(service.publish({ revisionId: current.draft!.revisionId, categories: [] })).rejects.toThrow();
    expect(await service.getPublished()).toBeNull();
  });
});
