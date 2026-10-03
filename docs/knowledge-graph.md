# 公开技术知识图谱

本功能独立于现有知识文章与 Vault 同步。只发布笔记标题、顶层目录分类、稳定的 SHA-256 标识和笔记引用关系。扫描时在本机读取 Markdown，但导出 JSON 不包含正文、附件、绝对/相对路径或原始 frontmatter。标题和分类仍可能包含个人信息，发布前应在后台预览并确认范围。

## 本地导出

在安装依赖的仓库目录运行（Node.js 24）：

```powershell
npm ci
npm run knowledge:graph -- --vault "F:\Project\Obsidian\个人技术栈" --out "C:\Exports\knowledge-graph-20261003.json"
```

输出目录需提前存在，必须在 Vault 外；已有输出文件不会被覆盖。工具不发网络请求，不修改 Vault，不读取图片或 PDF 内容，不跟随目录/文件符号链接。默认排除所有隐藏目录/文件、`Temp`、`temp`、`Skill`、`skill`、Excalidraw Markdown 文件；可重复传入 `--ignore 私人目录` 增加排除项。根目录的笔记分类为“未分类”。

支持 `[[笔记]]`、路径、别名、标题/块引用、`![[笔记]]` 和行内 Markdown 笔记链接；代码块、行内代码、HTML 注释、frontmatter 中的引用不形成关系。Wiki 链接优先匹配源笔记所在目录，再匹配 Vault 路径，最后使用唯一文件名/别名；Markdown 链接按源目录解析。目标笔记存在即保留关系，不要求被引用的标题或块存在。歧义/缺失引用不自动创造节点。图片/PDF 不作为节点；重复连线合并，自引用忽略。

本版不处理 Markdown 引用式链接、多行链接或复杂嵌套括号。仅支持最多 2,000 篇笔记、20,000 条有向关系和 4 MiB JSON；超过时先通过 `--ignore` 缩小范围。

## 导入与公开

在后台图谱入口导入 JSON，校验后形成私有草稿；预览、选择公开分类，再明确点击发布。导入新文件不会立即改变公开图谱。发布按当前草稿修订号检查，并删除所有指向未选分类的连线。每次更新仍使用同一流程。旧知识文章和附件保持原状。

## 数据与接口契约

`KnowledgeGraph` 类型与校验位于 `src/lib/knowledge/graph-contract.ts`：

```json
{
  "version": 1,
  "generatedAt": "2026-10-03T00:00:00.000Z",
  "nodes": [{"id": "64位小写SHA256", "title": "笔记标题", "category": "顶层分类"}],
  "edges": [{"source": "源节点id", "target": "目标节点id"}]
}
```

额外字段被拒绝，不会默默保存正文或路径。节点标识唯一，边必须连接两个不同的现有节点，同方向的边不能重复。

- `GET /api/admin/knowledge/graph`（管理员）：`{draft: {revisionId, graph, importedAt} | null, published: {publishedAt, nodeCount, edgeCount, categories} | null}`。
- `POST /api/admin/knowledge/graph`（管理员）：请求体直接是图谱 JSON，201 返回上述后台状态；仅导入草稿。
- `POST /api/admin/knowledge/graph/publish`（管理员）：`{revisionId, categories: string[]}`，返回后台状态；至少选一个已有分类。旧修订号拒绝发布。
- `GET /api/knowledge/graph`（公开）：只返回已发布的 `KnowledgeGraph` 或 `null`，无草稿字段。
- 服务端页面可调用 `getPublishedKnowledgeGraph()`；后台调用 `knowledgeGraphService.getAdmin()`；客户端可用 `selectKnowledgeGraphCategories()` 预览同样的分类过滤。

单行 `knowledge_graph_states` 表保存最新草稿和最新公开快照。迁移仅新增该表，不修改任何旧知识数据。首次部署需按项目现有升级流程执行 `prisma migrate deploy`，无需 seed/reset。
