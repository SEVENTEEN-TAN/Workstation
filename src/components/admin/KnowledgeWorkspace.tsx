"use client";

import { BookOpen, Database, FileText, FolderSearch, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { buildKnowledgeNoteTree, readKnowledgeProperties, type KnowledgeTreeItem } from "./knowledge-note-tree";
import { inspectKnowledgePublication } from "./knowledge-publication-inspector";
import { ObsidianMarkdownPreview } from "./ObsidianMarkdownPreview";
import { PageHeader } from "./PageHeader";
import { adminRequest } from "./request";
import type { KnowledgeArticleData, KnowledgeNoteData, KnowledgeNoteLinkData, KnowledgePublicationDraftData, KnowledgeSourceRevisionData, KnowledgeSyncChangeData, KnowledgeSyncReportData, KnowledgeVaultData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

type NoteContent = { relativePath: string; content: string };

function splitPatterns(value: FormDataEntryValue | null) {
  return String(value ?? "").split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function syntaxLabels(note: KnowledgeNoteData) {
  return [
    note.visibility === "PRIVATE" && "私有",
    note.isMoc && "MOC",
    note.hasFrontmatter && "YAML",
    note.hasWikilinks && "Link",
    note.hasEmbeds && "Embed",
    note.hasCallouts && "Callout",
    note.hasDataview && "Dataview",
    note.hasTasks && "Task",
  ].filter(Boolean) as string[];
}

function noteTitle(note: KnowledgeNoteData) {
  if (!note.frontmatterJson) return note.fileName;
  try {
    const { title } = JSON.parse(note.frontmatterJson) as { title?: unknown };
    return typeof title === "string" && title.trim() ? title.trim() : note.fileName;
  } catch {
    return note.fileName;
  }
}

function linkLabels(note: KnowledgeNoteData, links: KnowledgeNoteLinkData[]) {
  const outgoing = links.filter((link) => link.kind === "LINK" && link.sourceRelativePath === note.relativePath).length;
  const incoming = links.filter((link) => link.kind === "LINK" && link.targetRelativePath === note.relativePath).length;
  const embeds = links.filter((link) => link.kind === "EMBED" && link.sourceRelativePath === note.relativePath).length;
  return [outgoing && `出链 ${outgoing}`, incoming && `反链 ${incoming}`, embeds && `嵌入 ${embeds}`].filter(Boolean) as string[];
}

function reportSummary(report: KnowledgeSyncReportData) {
  return `+${report.addedCount} 新增 / ${report.modifiedCount} 修改 / ${report.movedCount} 移动 / ${report.missingCount} 缺失`;
}

function changeLabel(change: KnowledgeSyncChangeData) {
  const labels = { ADDED: "新增", MODIFIED: "已修改", MOVED: "已移动", MISSING: "疑似缺失" };
  return labels[change.type];
}

function changePath(change: KnowledgeSyncChangeData) {
  if (change.type === "MOVED") return `${change.previousRelativePath} -> ${change.currentRelativePath}`;
  return change.currentRelativePath ?? change.previousRelativePath ?? "";
}

function KnowledgeTree({ items, onOpenNote }: { items: KnowledgeTreeItem[]; onOpenNote: (note: KnowledgeNoteData) => void }) {
  return <ul className={styles.noteTree}>{items.map((item) => item.kind === "directory" ? (
    <li key={item.path}>
      <details open>
        <summary>{item.name}</summary>
        <KnowledgeTree items={item.children} onOpenNote={onOpenNote} />
      </details>
    </li>
  ) : <li key={item.note.id}><button type="button" onClick={() => onOpenNote(item.note)}><FileText size={13} />{noteTitle(item.note)}</button></li>)}</ul>;
}

export function KnowledgeWorkspace({ initialVaults }: { initialVaults: KnowledgeVaultData[] }) {
  const [vaults, setVaults] = useState(initialVaults);
  const [selectedId, setSelectedId] = useState(initialVaults[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [deleteRequest, setDeleteRequest] = useState<KnowledgeVaultData | null>(null);
  const [viewingNote, setViewingNote] = useState<KnowledgeNoteData | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteError, setNoteError] = useState("");
  const [isNoteLoading, setIsNoteLoading] = useState(false);
  const [draftSlugs, setDraftSlugs] = useState<Record<string, string>>({});
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const selected = vaults.find((vault) => vault.id === selectedId) ?? vaults[0] ?? null;
  const syncReport = selected?.syncReports[0] ?? null;
  const selectedLinks = selected?.noteLinks ?? [];
  const noteLinks = selectedLinks.filter((link) => link.kind === "LINK");
  const embeds = selectedLinks.filter((link) => link.kind === "EMBED");
  const unresolvedLinks = selectedLinks.filter((link) => !link.isResolved);
  const notes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!selected) return [];
    if (!normalized) return selected.notes;
    return selected.notes.filter((note) => note.relativePath.toLocaleLowerCase().includes(normalized));
  }, [query, selected]);
  const noteTree = useMemo(() => buildKnowledgeNoteTree(notes), [notes]);
  const viewingProperties = viewingNote ? readKnowledgeProperties(viewingNote) : [];
  const outgoingLinks = viewingNote ? selectedLinks.filter((link) => link.kind === "LINK" && link.sourceRelativePath === viewingNote.relativePath) : [];
  const incomingLinks = viewingNote ? selectedLinks.filter((link) => link.kind === "LINK" && link.targetRelativePath === viewingNote.relativePath) : [];
  const publicationChecks = viewingNote ? inspectKnowledgePublication(viewingNote, selectedLinks) : [];
  const viewingRevisions = viewingNote ? selected?.sourceRevisions.filter((revision) => revision.relativePath === viewingNote.relativePath) ?? [] : [];
  const totalNotes = vaults.reduce((sum, vault) => sum + vault.notes.length, 0);

  async function createVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const created = await runAction("knowledge:create", () => adminRequest<KnowledgeVaultData>(
      "/api/admin/knowledge/vaults",
      jsonRequest("POST", {
        name: data.get("name"),
        rootPath: data.get("rootPath"),
        ignorePatterns: splitPatterns(data.get("ignorePatterns")),
        enabled: true,
      }),
    ), "知识库已登记，可开始只读扫描");
    if (!created) return;
    setVaults((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
    setSelectedId(created.id);
    form.reset();
  }

  async function scanVault(vault: KnowledgeVaultData) {
    const scanned = await runAction(`knowledge:scan:${vault.id}`, () => adminRequest<KnowledgeVaultData>(
      `/api/admin/knowledge/vaults/${vault.id}/scan`,
      { method: "POST" },
    ), `扫描完成，共索引 ${vault.name} 的 Markdown 文件`);
    if (!scanned) return;
    setVaults((current) => current.map((item) => item.id === scanned.id ? scanned : item));
  }

  async function removeVault() {
    if (!deleteRequest) return;
    const removed = await runAction(`knowledge:delete:${deleteRequest.id}`, () => adminRequest<KnowledgeVaultData>(
      `/api/admin/knowledge/vaults/${deleteRequest.id}`,
      { method: "DELETE" },
    ), "知识库登记与索引已移除，本地文件未改动");
    if (!removed) return;
    setVaults((current) => current.filter((item) => item.id !== deleteRequest.id));
    if (selectedId === deleteRequest.id) setSelectedId("");
    setDeleteRequest(null);
  }

  async function viewNote(note: KnowledgeNoteData) {
    if (!selected) return;
    setViewingNote(note);
    setNoteContent("");
    setNoteError("");
    setIsNoteLoading(true);
    try {
      const result = await adminRequest<NoteContent>(`/api/admin/knowledge/vaults/${selected.id}/notes?path=${encodeURIComponent(note.relativePath)}`);
      setNoteContent(result.content);
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : "笔记正文不可用");
    } finally {
      setIsNoteLoading(false);
    }
  }

  function viewLinkedNote(relativePath: string | null) {
    const note = selected?.notes.find((item) => item.relativePath === relativePath);
    if (note) void viewNote(note);
  }

  async function createPublicationDraft(revision: KnowledgeSourceRevisionData) {
    const draft = await runAction(`knowledge:draft:${revision.id}`, () => adminRequest<KnowledgePublicationDraftData>(
      "/api/admin/knowledge/publications/drafts",
      jsonRequest("POST", { sourceRevisionId: revision.id }),
    ), "已创建私有发布草稿，可继续检查后续内容");
    if (!draft || !selected) return;
    setVaults((current) => current.map((vault) => vault.id !== selected.id ? vault : {
      ...vault,
      sourceRevisions: vault.sourceRevisions.map((item) => item.id === revision.id ? { ...item, draft } : item),
    }));
  }

  async function publishArticle(draft: KnowledgePublicationDraftData) {
    const article = await runAction(`knowledge:article:${draft.id}`, () => adminRequest<KnowledgeArticleData>(
      "/api/admin/knowledge/articles",
      jsonRequest("POST", { draftId: draft.id, slug: draftSlugs[draft.id]?.trim() ?? "" }),
    ), "文章已发布，公开内容已固定为当前草稿快照");
    if (!article || !selected) return;
    setVaults((current) => current.map((vault) => vault.id !== selected.id ? vault : {
      ...vault,
      sourceRevisions: vault.sourceRevisions.map((revision) => revision.draft?.id !== draft.id ? revision : {
        ...revision,
        draft: { ...revision.draft, article },
      }),
    }));
  }

  return (
    <section>
      <PageHeader title="个人知识库" description="登记本地 Obsidian Vault，执行只读扫描并检查 Markdown 结构。笔记正文与附件不会上传。" />

      <div className={styles.metrics}>
        <article><span>已登记 Vault</span><strong>{vaults.length}</strong></article>
        <article><span>已索引 Markdown</span><strong>{totalNotes}</strong></article>
        <article><span>已解析链接</span><strong>{vaults.reduce((sum, vault) => sum + vault.noteLinks.filter((link) => link.isResolved).length, 0)}</strong></article>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>LOCAL SOURCE</span><h2>登记知识库</h2></div><span>仅保存路径与索引元数据</span></div>
        <form className={styles.entityForm} onSubmit={createVault}>
          <label><span>名称</span><input name="name" required maxLength={120} placeholder="个人技术栈" /></label>
          <label><span>本机绝对路径</span><input name="rootPath" required maxLength={1000} placeholder="F:\\Project\\Obsidian\\..." /></label>
          <label className={styles.fullField}><span>额外忽略规则</span><textarea name="ignorePatterns" placeholder="private&#10;archive/drafts&#10;*.excalidraw.md" /></label>
          <div className={styles.entityFormActions}><button className={styles.primaryButton} disabled={isBusy("knowledge:create")}><Plus size={17} />{isBusy("knowledge:create") ? "登记中" : "登记知识库"}</button></div>
        </form>
      </section>

      {vaults.length ? (
        <div className={styles.knowledgeLayout}>
          <aside className={styles.vaultStack} aria-label="已登记知识库">
            {vaults.map((vault) => (
              <article key={vault.id} className={`${styles.vaultCard} ${selected?.id === vault.id ? styles.vaultCardActive : ""}`}>
                <button type="button" className={styles.vaultSelect} onClick={() => { setSelectedId(vault.id); setQuery(""); setViewingNote(null); }}>
                  <BookOpen size={18} /><span><strong>{vault.name}</strong><small>{vault.rootPath}</small></span>
                </button>
                <div className={styles.vaultMeta}><span>{vault.lastScanStatus === "NEVER" ? "尚未扫描" : vault.lastScanStatus === "FAILED" ? "扫描失败" : `${vault.lastScanFileCount} 篇`}</span><span>{vault.enabled ? "已启用" : "已停用"}</span></div>
                {vault.syncReports[0] ? <p className={styles.syncSummary}>{reportSummary(vault.syncReports[0])}</p> : null}
                {vault.lastScanError ? <p className={styles.inlineError}>{vault.lastScanError}</p> : null}
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => scanVault(vault)} disabled={!vault.enabled || isBusy(`knowledge:scan:${vault.id}`)}>{isBusy(`knowledge:scan:${vault.id}`) ? <LoaderCircle className={styles.spin} size={15} /> : <FolderSearch size={15} />}扫描知识库</button>
                  <button type="button" onClick={() => setDeleteRequest(vault)}><Trash2 size={15} />移除</button>
                </div>
              </article>
            ))}
          </aside>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}><div><span className={styles.kicker}>INDEX</span><h2>{selected?.name ?? "知识库索引"}</h2></div><span>{notes.length} / {selected?.notes.length ?? 0}</span></div>
             {syncReport ? <section className={styles.syncReport} aria-label="最新同步报告">
              <div className={styles.syncReportHeading}><strong>最新同步报告</strong><time dateTime={syncReport.scannedAt}>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(syncReport.scannedAt))}</time></div>
              <div className={styles.syncCounts}><span>新增 {syncReport.addedCount}</span><span>修改 {syncReport.modifiedCount}</span><span>移动 {syncReport.movedCount}</span><span>疑似缺失 {syncReport.missingCount}</span><span>未变 {syncReport.unchangedCount}</span></div>
              {syncReport.changes.length ? <div className={styles.syncChanges}>{syncReport.changes.slice(0, 8).map((change) => <div key={change.id}><span>{changeLabel(change)}</span><small>{changePath(change)}</small></div>)}{syncReport.changes.length > 8 ? <p>另有 {syncReport.changes.length - 8} 项变更未展开。</p> : null}</div> : <p className={styles.syncEmpty}>内容未变化，未生成待处理项。</p>}
             </section> : null}
             {selectedLinks.length ? <section className={styles.syncReport} aria-label="链接报告">
               <div className={styles.syncReportHeading}><strong>链接报告</strong><span>仅索引，不修改笔记</span></div>
               <div className={styles.syncCounts}><span>正向链接 {noteLinks.length}</span><span>已解析嵌入 {embeds.filter((link) => link.isResolved).length}</span><span>未解析链接 {unresolvedLinks.length}</span></div>
               {unresolvedLinks.length ? <div className={styles.syncChanges}>{unresolvedLinks.slice(0, 8).map((link) => <div key={link.id}><span>未解析</span><small>{link.sourceRelativePath} -&gt; {link.targetRaw}</small></div>)}{unresolvedLinks.length > 8 ? <p>另有 {unresolvedLinks.length - 8} 条未解析链接未展开。</p> : null}</div> : <p className={styles.syncEmpty}>所有内部链接都已解析。</p>}
             </section> : null}
             {viewingNote ? <section className={styles.noteViewer} aria-label="笔记正文">
               <div className={styles.syncReportHeading}><div><strong>{noteTitle(viewingNote)}</strong><small>{viewingNote.relativePath}</small></div><button type="button" className={styles.iconButton} title="关闭笔记" aria-label="关闭笔记" onClick={() => setViewingNote(null)}><X size={16} /></button></div>
               {isNoteLoading ? <p className={styles.syncEmpty}>正在读取笔记...</p> : noteError ? <p className={styles.inlineError} role="alert">{noteError}</p> : <ObsidianMarkdownPreview content={noteContent} />}
               <div className={styles.noteInspector}>
                 <section><h3>笔记属性</h3>{viewingProperties.length ? <dl>{viewingProperties.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl> : <p>没有可展示的 frontmatter 属性。</p>}</section>
                 <section><h3>正向链接</h3>{outgoingLinks.length ? <ul>{outgoingLinks.map((link) => <li key={link.id}>{link.isResolved && link.targetRelativePath ? <button type="button" onClick={() => viewLinkedNote(link.targetRelativePath)}>{link.displayLabel ?? link.targetRelativePath}</button> : <span>{link.displayLabel ?? link.targetRaw}（未解析）</span>}</li>)}</ul> : <p>没有正向链接。</p>}</section>
                 <section><h3>反向链接</h3>{incomingLinks.length ? <ul>{incomingLinks.map((link) => <li key={link.id}><button type="button" onClick={() => viewLinkedNote(link.sourceRelativePath)}>{link.displayLabel ?? link.sourceRelativePath}</button></li>)}</ul> : <p>没有反向链接。</p>}</section>
                 <section><h3>发布检查</h3><ul className={styles.publicationChecks}>{publicationChecks.map((check) => <li key={check.id} className={check.status === "READY" ? styles.publicationReady : check.status === "BLOCKED" ? styles.publicationBlocked : styles.publicationNotice}>{check.label}</li>)}</ul></section>
                  <section><h3>源修订</h3>{viewingRevisions.length ? <ul className={styles.sourceRevisionList}>{viewingRevisions.map((revision) => <li key={revision.id}><div><strong>{revision.contentHash.slice(0, 10)}</strong><time dateTime={revision.capturedAt}>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(revision.capturedAt))}</time></div>{revision.draft?.article ? <span>已发布：/{revision.draft.article.slug}</span> : revision.draft ? <div className={styles.articlePublishForm}><span>草稿：{revision.draft.title}</span><label><span className="srOnly">文章路径</span><input value={draftSlugs[revision.draft.id] ?? ""} onChange={(event) => setDraftSlugs((current) => ({ ...current, [revision.draft!.id]: event.target.value }))} placeholder="article-slug" aria-label="文章路径" maxLength={96} /></label><button type="button" onClick={() => publishArticle(revision.draft!)} disabled={isBusy(`knowledge:article:${revision.draft.id}`)}>{isBusy(`knowledge:article:${revision.draft.id}`) ? "发布中" : "发布文章"}</button></div> : <button type="button" onClick={() => createPublicationDraft(revision)} disabled={isBusy(`knowledge:draft:${revision.id}`)}>{isBusy(`knowledge:draft:${revision.id}`) ? "创建中" : "创建发布草稿"}</button>}</li>)}</ul> : <p>尚未捕获源修订，请重新扫描知识库。</p>}</section>
               </div>
             </section> : null}
            {selected?.lastScanStatus !== "NEVER" ? (
              <>
                <label className={styles.searchField}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索相对路径" aria-label="搜索相对路径" /></label>
                {notes.length ? <div className={styles.knowledgeIndexLayout}><aside className={styles.knowledgeTree} aria-label="知识库目录"><strong>知识库目录</strong><KnowledgeTree items={noteTree} onOpenNote={viewNote} /></aside><div className={styles.noteTable}>{notes.map((note) => (
                  <article key={note.id} className={styles.noteRow}>
                    <div><strong>{noteTitle(note)}</strong><small>{note.relativePath}</small><button type="button" className={styles.noteViewButton} onClick={() => viewNote(note)}><FileText size={13} />查看笔记</button></div>
                    <span>{formatBytes(note.sizeBytes)}</span>
                    <time dateTime={note.modifiedAt}>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(note.modifiedAt))}</time>
                     <div className={styles.noteBadges}>{[...syntaxLabels(note), ...linkLabels(note, selectedLinks)].map((label) => <span key={label}>{label}</span>)}</div>
                  </article>
                ))}</div></div> : <EmptyState title="没有匹配的 Markdown" description="调整搜索条件，或重新扫描知识库。" action={<button type="button" onClick={() => setQuery("")}>清除搜索</button>} />}
              </>
            ) : <EmptyState title="尚未扫描知识库" description="扫描只读取 Markdown 元数据，不会修改本地文件。" action={<button type="button" className={styles.primaryButton} onClick={() => selected && scanVault(selected)}><Database size={17} />扫描知识库</button>} />}
          </section>
        </div>
      ) : <EmptyState title="还没有登记知识库" description="先登记本机 Obsidian Vault，再执行只读扫描。" action={null} />}

      <ConfirmDialog open={Boolean(deleteRequest)} title="移除知识库登记" target={deleteRequest?.name ?? ""} description="只会删除工作站中的路径配置与索引，不会删除或修改本地 Vault 文件。" busy={deleteRequest ? isBusy(`knowledge:delete:${deleteRequest.id}`) : false} confirmLabel="确认移除" busyLabel="移除中" onConfirm={removeVault} onCancel={() => setDeleteRequest(null)} />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
