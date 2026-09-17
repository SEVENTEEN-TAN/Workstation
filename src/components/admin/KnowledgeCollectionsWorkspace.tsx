"use client";

import { Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { adminRequest } from "./request";
import type { KnowledgeCollectionArticleData, KnowledgeCollectionData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

type Editor = KnowledgeCollectionData | "new" | null;

function payload(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    title: String(data.get("title") ?? ""),
    description: String(data.get("description") ?? ""),
    slug: String(data.get("slug") ?? ""),
    visibility: String(data.get("visibility") ?? "PRIVATE"),
    sortOrder: Number(data.get("sortOrder") ?? 0),
    articleIds: data.getAll("articleIds").map(String),
  };
}

export function KnowledgeCollectionsWorkspace({ initialCollections, initialArticles }: { initialCollections: KnowledgeCollectionData[]; initialArticles: KnowledgeCollectionArticleData[] }) {
  const [collections, setCollections] = useState(initialCollections);
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteRequest, setDeleteRequest] = useState<KnowledgeCollectionData | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const editing = editor !== null && editor !== "new" ? editor : null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await runAction("knowledge:collection:save", () => adminRequest<KnowledgeCollectionData>(
      editing ? `/api/admin/knowledge/collections/${editing.id}` : "/api/admin/knowledge/collections",
      jsonRequest(editing ? "PATCH" : "POST", payload(event.currentTarget)),
    ), editing ? "知识合集已更新" : "知识合集已创建");
    if (!saved) return;
    setCollections((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]);
    setEditor(null);
  }

  async function remove() {
    if (!deleteRequest) return;
    const removed = await runAction(`knowledge:collection:delete:${deleteRequest.id}`, () => adminRequest<KnowledgeCollectionData>(`/api/admin/knowledge/collections/${deleteRequest.id}`, { method: "DELETE" }), "知识合集已删除，文章保持不变");
    if (!removed) return;
    setCollections((current) => current.filter((item) => item.id !== deleteRequest.id));
    setDeleteRequest(null);
  }

  return <section>
    <PageHeader title="知识合集" description="将已经发布的文章整理为主题路径；合集本身可独立设为公开或私有。" action={<Link href="/admin/knowledge" className={styles.secondaryButton}>返回知识库</Link>} />
    <div className={styles.rowActions}><button type="button" className={styles.primaryButton} onClick={() => setEditor("new")}><Plus size={17} />新建合集</button></div>
    {editor ? <section className={styles.panel}><div className={styles.sectionHeading}><div><span className={styles.kicker}>COLLECTION</span><h2>{editing ? "编辑合集" : "新建合集"}</h2></div><button type="button" className={styles.iconButton} aria-label="关闭编辑" onClick={() => setEditor(null)}><X size={16} /></button></div><form className={styles.entityForm} onSubmit={save}>
      <label><span>名称</span><input name="title" required maxLength={160} defaultValue={editing?.title ?? ""} /></label><label><span>URL 标识</span><input name="slug" required maxLength={96} placeholder="java-foundations" defaultValue={editing?.slug ?? ""} /></label>
      <label><span>可见性</span><select name="visibility" defaultValue={editing?.visibility ?? "PRIVATE"}><option value="PRIVATE">私有</option><option value="PUBLIC">公开</option></select></label><label><span>排序</span><input name="sortOrder" type="number" min="0" defaultValue={editing?.sortOrder ?? 0} /></label>
      <label className={styles.fullField}><span>简介</span><textarea name="description" maxLength={1000} defaultValue={editing?.description ?? ""} /></label>
      <fieldset className={`${styles.fullField} ${styles.knowledgeCollectionArticles}`}><legend>已发布文章</legend>{initialArticles.length ? initialArticles.map((article) => <label key={article.id}><input type="checkbox" name="articleIds" value={article.id} defaultChecked={editing?.articles.some((item) => item.id === article.id)} /><span><strong>{article.title}</strong><small>/{article.slug}</small></span></label>) : <p>暂时没有可加入的已发布文章。</p>}</fieldset>
      <div className={styles.entityFormActions}><button className={styles.primaryButton} disabled={isBusy("knowledge:collection:save")}>{isBusy("knowledge:collection:save") ? "保存中" : "保存合集"}</button></div>
    </form></section> : null}
    {collections.length ? <div className={styles.entityList}>{collections.map((collection) => <article key={collection.id} className={styles.entityCard}><div className={styles.entityHead}><div><span className={styles.kicker}>{collection.visibility}</span><h2>{collection.title}</h2><p>/{collection.slug} · {collection.articles.length} 篇文章</p></div><div className={styles.rowActions}><button type="button" onClick={() => setEditor(collection)}><Pencil size={15} />编辑</button><button type="button" onClick={() => setDeleteRequest(collection)}><Trash2 size={15} />删除</button></div></div>{collection.description ? <p>{collection.description}</p> : null}<div className={styles.collectionArticleLinks}>{collection.articles.map((article) => <Link key={article.id} href={`/knowledge/${article.slug}`} target="_blank"><Link2 size={13} />{article.title}</Link>)}</div></article>)}</div> : <EmptyState title="还没有知识合集" description="先发布文章，再把相关内容收进一个主题合集。" action={null} />}
    <ConfirmDialog open={Boolean(deleteRequest)} title="删除知识合集" target={deleteRequest?.title ?? ""} description="只会删除合集与其文章排序关系，不会删除任何已发布文章。" busy={deleteRequest ? isBusy(`knowledge:collection:delete:${deleteRequest.id}`) : false} onConfirm={remove} onCancel={() => setDeleteRequest(null)} />
    <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
  </section>;
}
