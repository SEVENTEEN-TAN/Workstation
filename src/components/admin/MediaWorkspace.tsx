"use client";

import Image from "next/image";
import { Eye, Link2, LoaderCircle, RefreshCw, Save, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { EmptyState } from "./EmptyState";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { adminRequest, uploadAdminAsset } from "./request";
import type { AssetData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

type AssetFilters = { query: string; mimeType: string; altState: "" | "complete" | "missing" };

export function filterAssets(assets: AssetData[], filters: AssetFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return assets.filter((asset) => {
    const matchesQuery = !query || [asset.originalFilename, asset.altTextZh, asset.altTextEn]
      .some((value) => value?.toLocaleLowerCase().includes(query));
    const matchesType = !filters.mimeType || asset.mimeType === filters.mimeType;
    const complete = Boolean(asset.altTextZh && asset.altTextEn);
    const matchesAlt = !filters.altState || (filters.altState === "complete" ? complete : !complete);
    return matchesQuery && matchesType && matchesAlt;
  });
}

const VERSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "历史版本",
};

function formatReferencePath(path: string) {
  const project = path.match(/^(zh|en)\.projects\.(\d+)\.image$/);
  if (project) return `${project[1] === "zh" ? "中文" : "English"} · 项目 ${Number(project[2]) + 1} · 图片`;
  return path;
}

export function MediaWorkspace({ initialAssets }: { initialAssets: AssetData[] }) {
  const [assets, setAssets] = useState(initialAssets);
  const [filters, setFilters] = useState<AssetFilters>({ query: "", mimeType: "", altState: "" });
  const [selectedAsset, setSelectedAsset] = useState<AssetData | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<AssetData | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const visibleAssets = useMemo(() => filterAssets(assets, filters), [assets, filters]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selectedAsset && !dialog.open) dialog.showModal();
    if (!selectedAsset && dialog.open) dialog.close();
  }, [selectedAsset]);

  async function fetchAssets() {
    setAssets(await adminRequest<AssetData[]>("/api/admin/assets"));
  }

  async function uploadAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setUploadProgress(0);
    const uploaded = await runAction("media:upload", async () => {
      await uploadAdminAsset<AssetData>(new FormData(form), setUploadProgress);
      await fetchAssets();
      return true;
    }, "图片已上传");
    if (uploaded) form.reset();
  }

  async function saveAltText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAsset) return;
    const form = new FormData(event.currentTarget);
    const updated = await runAction(`media:alt:${selectedAsset.id}`, () => adminRequest<AssetData>(
      `/api/admin/assets/${selectedAsset.id}`,
      jsonRequest("PATCH", { altTextZh: form.get("altTextZh"), altTextEn: form.get("altTextEn") }),
    ), "替代文本已保存");
    if (!updated) return;
    const enriched = { ...updated, references: selectedAsset.references, isReferenced: selectedAsset.isReferenced };
    setAssets((current) => current.map((asset) => asset.id === enriched.id ? enriched : asset));
    setSelectedAsset(enriched);
  }

  async function deleteAsset() {
    if (!deleteRequest) return;
    const deleted = await runAction(`media:delete:${deleteRequest.id}`, () => adminRequest<{ id: string }>(
      `/api/admin/assets/${deleteRequest.id}`,
      jsonRequest("DELETE", {}),
    ), "媒体资源已删除");
    if (!deleted) return;
    setAssets((current) => current.filter((asset) => asset.id !== deleted.id));
    setDeleteRequest(null);
  }

  function requestDelete(asset: AssetData) {
    if (asset.references.length) return;
    setSelectedAsset(null);
    setDeleteRequest(asset);
  }

  function openPreview(asset: AssetData, trigger: HTMLButtonElement) {
    previewTriggerRef.current = trigger;
    setSelectedAsset(asset);
  }

  function resetFilters() {
    setFilters({ query: "", mimeType: "", altState: "" });
  }

  const refreshBusy = isBusy("media:refresh");
  const uploadBusy = isBusy("media:upload");
  const altBusy = selectedAsset ? isBusy(`media:alt:${selectedAsset.id}`) : false;
  const deleteBusy = deleteRequest ? isBusy(`media:delete:${deleteRequest.id}`) : false;

  return (
    <section>
      <PageHeader
        title="媒体资源"
        description="上传、检索并管理主页使用的本地图片资源。"
        action={<button type="button" className={styles.iconTextButton} onClick={() => runAction("media:refresh", fetchAssets, "媒体列表已更新")} disabled={refreshBusy}>{refreshBusy ? <LoaderCircle className={styles.spin} size={18} /> : <RefreshCw size={18} />}{refreshBusy ? "刷新中" : "刷新"}</button>}
      />

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>UPLOAD</span><h2>上传图片</h2></div></div>
        <form className={`${styles.formGrid} ${styles.mediaForm}`} onSubmit={uploadAsset}>
          <label className={styles.fileField}><span>图片文件</span><input ref={fileInputRef} name="file" type="file" accept="image/png,image/jpeg,image/webp" required disabled={uploadBusy} /></label>
          <label><span>中文替代文本</span><input name="altTextZh" maxLength={500} placeholder="描述图片内容" disabled={uploadBusy} /></label>
          <label><span>英文替代文本</span><input name="altTextEn" maxLength={500} placeholder="Describe the image" disabled={uploadBusy} /></label>
          <button className={styles.primaryButton} disabled={uploadBusy}>{uploadBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Upload size={17} />}{uploadBusy ? "上传中" : "上传"}</button>
        </form>
        {uploadBusy ? <div className={styles.uploadProgress}><progress max="100" value={uploadProgress}>{uploadProgress}%</progress><span>{uploadProgress}%</span></div> : null}
      </section>

      {assets.length ? (
        <>
          <section className={`${styles.panel} ${styles.mediaToolbar}`} aria-label="媒体筛选">
            <label className={styles.mediaSearch}><Search size={17} aria-hidden="true" /><span className={styles.srOnly}>搜索文件名或替代文本</span><input type="search" placeholder="搜索文件名或替代文本" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} /></label>
            <label><span className={styles.srOnly}>图片类型</span><select value={filters.mimeType} onChange={(event) => setFilters((current) => ({ ...current, mimeType: event.target.value }))}><option value="">全部类型</option><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>
            <label><span className={styles.srOnly}>替代文本状态</span><select value={filters.altState} onChange={(event) => setFilters((current) => ({ ...current, altState: event.target.value as AssetFilters["altState"] }))}><option value="">全部文本状态</option><option value="complete">双语完整</option><option value="missing">需要补充</option></select></label>
            <span>{visibleAssets.length} / {assets.length} 项</span>
          </section>
          {visibleAssets.length ? (
            <div className={styles.assetGrid}>
              {visibleAssets.map((asset) => (
                <article key={asset.id}>
                  <button type="button" className={styles.assetCardButton} onClick={(event) => openPreview(asset, event.currentTarget)} aria-label={`预览图片 ${asset.originalFilename}`}>
                    <Image src={`/api/assets/${asset.id}`} alt={asset.altTextZh ?? asset.originalFilename} width={asset.width ?? 640} height={asset.height ?? 480} unoptimized />
                    <div><strong>{asset.originalFilename}</strong><small>{Math.round(asset.sizeBytes / 1024)} KB · {asset.mimeType}</small><span className={asset.references.length ? styles.assetUsageActive : styles.assetUsage}><Link2 size={14} />{asset.references.length ? `使用中 · ${asset.references.length} 处` : "未使用"}</span><span><Eye size={14} />预览图片</span></div>
                  </button>
                </article>
              ))}
            </div>
          ) : <section className={styles.panel}><EmptyState title="没有匹配的媒体" description="调整搜索词或筛选条件后重试。" action={<button type="button" className={styles.secondaryButton} onClick={resetFilters}>清除筛选</button>} /></section>}
        </>
      ) : <section className={styles.panel}><EmptyState title="还没有媒体资源" description="上传第一张图片后，可在主页内容中引用。" action={<button type="button" className={styles.secondaryButton} onClick={() => fileInputRef.current?.focus()}>选择图片</button>} /></section>}

      <dialog ref={dialogRef} className={styles.assetDialog} aria-labelledby="asset-preview-title" onCancel={(event) => { event.preventDefault(); if (!altBusy) setSelectedAsset(null); }} onClose={() => previewTriggerRef.current?.focus()}>
        {selectedAsset ? (
          <div className={styles.assetDialogLayout}>
            <div className={styles.assetPreview}><Image src={`/api/assets/${selectedAsset.id}`} alt={selectedAsset.altTextZh ?? selectedAsset.originalFilename} width={selectedAsset.width ?? 1200} height={selectedAsset.height ?? 900} unoptimized /></div>
            <div className={styles.assetDetails}>
              <div className={styles.assetDialogHead}><div><span className={styles.kicker}>PREVIEW</span><h2 id="asset-preview-title">{selectedAsset.originalFilename}</h2></div><button type="button" className={styles.iconButton} aria-label="关闭预览" onClick={() => setSelectedAsset(null)} disabled={altBusy}><X size={18} /></button></div>
              <dl><div><dt>格式</dt><dd>{selectedAsset.mimeType}</dd></div><div><dt>大小</dt><dd>{Math.round(selectedAsset.sizeBytes / 1024)} KB</dd></div><div><dt>尺寸</dt><dd>{selectedAsset.width && selectedAsset.height ? `${selectedAsset.width} × ${selectedAsset.height}` : "未记录"}</dd></div><div><dt>地址</dt><dd><code>/api/assets/{selectedAsset.id}</code></dd></div></dl>
              <section className={styles.assetReferences} aria-labelledby="asset-reference-title">
                <div><h3 id="asset-reference-title">使用位置</h3><span>{selectedAsset.references.length} 处</span></div>
                {selectedAsset.references.length ? (
                  <ul>{selectedAsset.references.map((reference) => <li key={`${reference.versionId}:${reference.path}`}><strong>版本 {reference.version} · {VERSION_STATUS_LABELS[reference.status] ?? reference.status}</strong><span>{formatReferencePath(reference.path)}</span></li>)}</ul>
                ) : <p>当前未被任何内容版本引用，可以安全删除。</p>}
              </section>
              <form key={selectedAsset.id} className={styles.formGrid} onSubmit={saveAltText}>
                <label><span>中文替代文本</span><textarea name="altTextZh" rows={3} maxLength={500} defaultValue={selectedAsset.altTextZh ?? ""} disabled={altBusy} /></label>
                <label><span>英文替代文本</span><textarea name="altTextEn" rows={3} maxLength={500} defaultValue={selectedAsset.altTextEn ?? ""} disabled={altBusy} /></label>
                <button className={styles.primaryButton} disabled={altBusy}>{altBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}{altBusy ? "保存中" : "保存替代文本"}</button>
              </form>
              <div className={styles.assetDeleteArea}>
                <button type="button" className={styles.dangerButton} disabled={altBusy || selectedAsset.references.length > 0} onClick={() => requestDelete(selectedAsset)}><Trash2 size={17} />删除资源</button>
                {selectedAsset.references.length ? <p>仍被内容版本引用，无法删除。请先在主页内容中移除所有使用位置。</p> : null}
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
      <ConfirmDialog
        open={Boolean(deleteRequest)}
        title="删除媒体资源"
        target={deleteRequest?.originalFilename ?? ""}
        description="删除后将同时移除本地文件，且无法恢复。"
        busy={deleteBusy}
        triggerRef={previewTriggerRef}
        onConfirm={deleteAsset}
        onCancel={() => setDeleteRequest(null)}
      />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
