import { parseArgs } from "node:util";
import { realpath, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { exportKnowledgeGraph } from "../src/lib/knowledge/graph-export";
import { KNOWLEDGE_GRAPH_MAX_BYTES } from "../src/lib/knowledge/graph-contract";

async function main() {
  const { values } = parseArgs({ options: { vault: { type: "string" }, out: { type: "string" }, ignore: { type: "string", multiple: true }, help: { type: "boolean" } } });
  if (values.help) {
    console.log('npm run knowledge:graph -- --vault "F:\\Project\\Obsidian\\个人技术栈" --out "C:\\Exports\\knowledge-graph.json" [--ignore 私人目录]');
  } else {
    if (!values.vault || !values.out) throw new Error("请指定 --vault 本地知识库和 --out 图谱 JSON 文件");
    const vault = await realpath(resolve(values.vault));
    const output = resolve(values.out);
    if (extname(output).toLowerCase() !== ".json") throw new Error("导出文件必须以 .json 结尾");
    const outputDirectory = await realpath(dirname(output));
    const pathFromVault = relative(vault, resolve(outputDirectory, output.split(sep).at(-1)!));
    if (!pathFromVault.startsWith(`..${sep}`) && pathFromVault !== ".." && !/^(?:[A-Za-z]:|[\\/])/.test(pathFromVault)) throw new Error("导出位置必须在 Vault 外，扫描不会修改知识库");
    const { graph, diagnostics } = await exportKnowledgeGraph(vault, values.ignore);
    const json = JSON.stringify(graph, null, 2);
    const bytes = Buffer.byteLength(json, "utf8");
    if (bytes > KNOWLEDGE_GRAPH_MAX_BYTES) throw new Error("图谱超过 4 MiB，请通过 --ignore 缩小导出范围");
    await writeFile(output, json, { encoding: "utf8", flag: "wx" });
    console.log(`图谱已导出：${graph.nodes.length} 篇笔记，${graph.edges.length} 条连线，${bytes} 字节。未解析引用 ${diagnostics.unresolvedLinks}，歧义引用 ${diagnostics.ambiguousLinks}。`);
    console.log("仅导出标题、分类、标识和关系；请在后台预览并选择公开分类后发布。");
  }
}

main().catch((error: unknown) => {
  const code = (error as NodeJS.ErrnoException).code;
  const message = code === "EEXIST" ? "目标文件已存在，请使用新的 --out 文件名" : code === "ENOENT" ? "Vault 或输出目录不存在" : error instanceof Error ? error.message : "图谱导出失败";
  console.error(message);
  process.exitCode = 1;
});
