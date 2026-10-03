"use client";

import { ExternalLink, FileJson, Upload } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import styles from "../../app/admin/admin.module.css";
import graphStyles from "./knowledge-graph-admin.module.css";
import { KNOWLEDGE_GRAPH_MAX_BYTES, knowledgeGraphSchema, selectKnowledgeGraphCategories } from "@/lib/knowledge/graph-contract";
import type { KnowledgeGraphAdminData } from "@/lib/services/knowledge-graph";
import { KnowledgeGraphView } from "../knowledge/KnowledgeGraphView";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { adminRequest } from "./request";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

export function KnowledgeGraphWorkspace({ initialData }: { initialData: KnowledgeGraphAdminData }) {
  const [data, setData] = useState(initialData);
  const [selectedCategories, setSelectedCategories] = useState(() => [...new Set(initialData.draft?.graph.nodes.map((node) => node.category))].sort());
  const [confirmPublish, setConfirmPublish] = useState(false);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const busy = isBusy("knowledge:graph");
  const categories = [...new Set(data.draft?.graph.nodes.map((node) => node.category))].sort();
  const preview = data.draft && selectedCategories.length ? selectKnowledgeGraphCategories(data.draft.graph, selectedCategories) : null;

  async function importFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("graphFile");
    const result = await runAction("knowledge:graph", async () => {
      if (!(file instanceof File) || !file.size) throw new Error("请选择本地导出的图谱 JSON 文件");
      if (file.size > KNOWLEDGE_GRAPH_MAX_BYTES) throw new Error("图谱文件不能超过 4 MiB");
      let input: unknown;
      try { input = JSON.parse(await file.text()); } catch { throw new Error("文件必须是有效的图谱 JSON"); }
      const parsed = knowledgeGraphSchema.safeParse(input);
      if (!parsed.success) throw new Error(`图谱格式不正确：${parsed.error.issues[0].message}`);
      return adminRequest<KnowledgeGraphAdminData>("/api/admin/knowledge/graph", jsonRequest("POST", parsed.data));
    }, "已导入私有草稿，请预览并选择公开分类");
    if (!result) return;
    setData(result);
    setSelectedCategories([...new Set(result.draft?.graph.nodes.map((node) => node.category))].sort());
    form.reset();
  }

  async function publish() {
    if (!data.draft || !preview) return;
    const result = await runAction("knowledge:graph", () => adminRequest<KnowledgeGraphAdminData>("/api/admin/knowledge/graph/publish", jsonRequest("POST", { revisionId: data.draft!.revisionId, categories: selectedCategories })), "技术知识图谱已公开发布");
    if (result) { setData(result); setConfirmPublish(false); }
  }

  return <section className={graphStyles.workspace}>
    <PageHeader title="技术知识图谱" description="从本地 Obsidian 导出笔记关系，预览后发布到网站。正文和附件留在本地。" action={<Link href="/knowledge/graph" target="_blank" className={graphStyles.publicLink}><ExternalLink size={16} />查看公开图谱</Link>} />
    <section className={styles.panel}>
      <div className={styles.sectionHeading}><div><h2>导入图谱</h2><p className={graphStyles.description}>选择本地导出的 JSON；导入只更新私有草稿，公开内容保持到下一次发布。</p></div><span className={graphStyles.publicStatus}>{data.published ? `已公开 ${data.published.nodeCount} 篇 · ${data.published.edgeCount} 条引用` : "尚未公开"}</span></div>
      <form onSubmit={importFile} className={graphStyles.importForm}><label><span>图谱 JSON 文件</span><input name="graphFile" type="file" accept=".json,application/json" required disabled={busy} /><small>最大 4 MiB，最多 2,000 篇笔记。标题与分类也会公开，请先检查。</small></label><button type="submit" className={styles.primaryButton} disabled={busy}><Upload size={16} />{busy ? "处理中" : "导入草稿"}</button></form>
      <details className={graphStyles.instructions}><summary>如何从本地 Obsidian 导出</summary><p>在安装依赖的 Workstation 仓库目录运行，输出目录需要在 Vault 外且提前存在：</p><code>npm run knowledge:graph -- --vault &quot;F:\Project\Obsidian\个人技术栈&quot; --out &quot;C:\Exports\knowledge-graph.json&quot;</code><p>默认排除隐藏工具目录、Temp 和 Skill；可以通过 --ignore 增加排除目录。每次更新重新导出、导入并发布。</p></details>
    </section>
    {data.draft ? <section className={graphStyles.previewSection}>
      <div className={graphStyles.previewHeading}><div><h2>公开范围与预览</h2><p>草稿共 {data.draft.graph.nodes.length} 篇笔记 · {data.draft.graph.edges.length} 条引用</p></div><button type="button" className={styles.primaryButton} disabled={busy || !preview} onClick={() => setConfirmPublish(true)}>发布图谱</button></div>
      <fieldset className={graphStyles.categories} disabled={busy}><legend>选择公开分类</legend>{categories.map((category) => <label key={category}><input type="checkbox" checked={selectedCategories.includes(category)} onChange={(event) => setSelectedCategories((current) => event.target.checked ? [...current, category] : current.filter((item) => item !== category))} /><span>{category}</span><small>{data.draft!.graph.nodes.filter((node) => node.category === category).length}</small></label>)}</fieldset>
      {preview ? <KnowledgeGraphView key={`${data.draft.revisionId}:${[...selectedCategories].sort().join("|")}`} graph={preview} /> : <p className={graphStyles.selectionEmpty} role="status">至少选择一个分类后才能预览与发布。</p>}
      <p className={graphStyles.previewNote}>预览仅包含所选分类，指向未选分类的连线会一并排除。公开页面只展示标题、分类和引用关系。</p>
    </section> : <div className={graphStyles.empty}><FileJson size={26} /><h2>先导入一份知识地图</h2><p>不需要上传 Vault、图片或 PDF，导入后就能预览笔记之间的联系。</p></div>}
    <ConfirmDialog open={confirmPublish} title="公开发布知识图谱" target={preview ? `${preview.nodes.length} 篇笔记 · ${preview.edges.length} 条引用` : ""} description={`以下分类的标题和关系将对所有访客可见：${selectedCategories.join("、")}。此次发布会替换当前公开图谱。`} confirmLabel="确认发布" busyLabel="发布中" busy={busy} onConfirm={() => void publish()} onCancel={() => setConfirmPublish(false)} />
    <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
  </section>;
}
