"use client";

import { BookOpen, Database, FolderSearch, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { adminRequest } from "./request";
import type { KnowledgeNoteData, KnowledgeVaultData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

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
    note.hasFrontmatter && "YAML",
    note.hasWikilinks && "Link",
    note.hasEmbeds && "Embed",
    note.hasCallouts && "Callout",
    note.hasDataview && "Dataview",
    note.hasTasks && "Task",
  ].filter(Boolean) as string[];
}

export function KnowledgeWorkspace({ initialVaults }: { initialVaults: KnowledgeVaultData[] }) {
  const [vaults, setVaults] = useState(initialVaults);
  const [selectedId, setSelectedId] = useState(initialVaults[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [deleteRequest, setDeleteRequest] = useState<KnowledgeVaultData | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const selected = vaults.find((vault) => vault.id === selectedId) ?? vaults[0] ?? null;
  const notes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!selected) return [];
    if (!normalized) return selected.notes;
    return selected.notes.filter((note) => note.relativePath.toLocaleLowerCase().includes(normalized));
  }, [query, selected]);
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

  return (
    <section>
      <PageHeader title="个人知识库" description="登记本地 Obsidian Vault，执行只读扫描并检查 Markdown 结构。笔记正文与附件不会上传。" />

      <div className={styles.metrics}>
        <article><span>已登记 Vault</span><strong>{vaults.length}</strong></article>
        <article><span>已索引 Markdown</span><strong>{totalNotes}</strong></article>
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
                <button type="button" className={styles.vaultSelect} onClick={() => { setSelectedId(vault.id); setQuery(""); }}>
                  <BookOpen size={18} /><span><strong>{vault.name}</strong><small>{vault.rootPath}</small></span>
                </button>
                <div className={styles.vaultMeta}><span>{vault.lastScanStatus === "NEVER" ? "尚未扫描" : vault.lastScanStatus === "FAILED" ? "扫描失败" : `${vault.lastScanFileCount} 篇`}</span><span>{vault.enabled ? "已启用" : "已停用"}</span></div>
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
            {selected?.lastScanStatus !== "NEVER" ? (
              <>
                <label className={styles.searchField}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索相对路径" aria-label="搜索相对路径" /></label>
                {notes.length ? <div className={styles.noteTable}>{notes.map((note) => (
                  <article key={note.id} className={styles.noteRow}>
                    <div><strong>{note.fileName}</strong><small>{note.relativePath}</small></div>
                    <span>{formatBytes(note.sizeBytes)}</span>
                    <time dateTime={note.modifiedAt}>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(note.modifiedAt))}</time>
                    <div className={styles.noteBadges}>{syntaxLabels(note).map((label) => <span key={label}>{label}</span>)}</div>
                  </article>
                ))}</div> : <EmptyState title="没有匹配的 Markdown" description="调整搜索条件，或重新扫描知识库。" action={<button type="button" onClick={() => setQuery("")}>清除搜索</button>} />}
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
