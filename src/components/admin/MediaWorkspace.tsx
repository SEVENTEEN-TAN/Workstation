"use client";

import Image from "next/image";
import { LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { adminRequest } from "./request";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import type { AssetData } from "./types";
import { useAdminAction } from "./useAdminAction";

export function MediaWorkspace({ initialAssets }: { initialAssets: AssetData[] }) {
  const [assets, setAssets] = useState(initialAssets);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();

  async function fetchAssets() {
    setAssets(await adminRequest<AssetData[]>("/api/admin/assets"));
  }

  async function refreshAssets() {
    await runAction("media:refresh", fetchAssets, "媒体列表已更新");
  }

  async function uploadAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await runAction("media:upload", async () => {
      await adminRequest("/api/admin/assets", { method: "POST", body: form });
      await fetchAssets();
      return true;
    }, "图片已上传");
    if (result) formElement.reset();
  }

  const refreshBusy = isBusy("media:refresh");
  const uploadBusy = isBusy("media:upload");

  return (
    <section>
      <PageHeader
        title="媒体资源"
        description="上传并管理主页使用的本地图片资源。"
        action={(
          <button type="button" className={styles.iconTextButton} onClick={refreshAssets} disabled={refreshBusy}>
            {refreshBusy ? <LoaderCircle className={styles.spin} size={18} /> : <RefreshCw size={18} />}
            {refreshBusy ? "刷新中" : "刷新"}
          </button>
        )}
      />

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>UPLOAD</span><h2>上传图片</h2></div></div>
        <form className={`${styles.formGrid} ${styles.mediaForm}`} onSubmit={uploadAsset}>
          <label className={styles.fileField}>
            <span>图片文件</span>
            <input ref={fileInputRef} name="file" type="file" accept="image/png,image/jpeg,image/webp" required disabled={uploadBusy} />
          </label>
          <label><span>中文替代文本</span><input name="altTextZh" placeholder="描述图片内容" disabled={uploadBusy} /></label>
          <label><span>英文替代文本</span><input name="altTextEn" placeholder="Describe the image" disabled={uploadBusy} /></label>
          <button className={styles.primaryButton} disabled={uploadBusy}>
            {uploadBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Upload size={17} />}
            {uploadBusy ? "上传中" : "上传"}
          </button>
        </form>
      </section>

      {assets.length ? (
        <div className={styles.assetGrid}>
          {assets.map((asset) => (
            <article key={asset.id}>
              <Image
                src={`/api/assets/${asset.id}`}
                alt={asset.altTextZh ?? asset.originalFilename}
                width={asset.width ?? 640}
                height={asset.height ?? 480}
                unoptimized
              />
              <div>
                <strong>{asset.originalFilename}</strong>
                <small>{Math.round(asset.sizeBytes / 1024)} KB · {asset.mimeType}</small>
                <code>/api/assets/{asset.id}</code>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.panel}>
          <EmptyState
            title="还没有媒体资源"
            description="上传第一张图片后，可在主页内容中引用。"
            action={<button type="button" className={styles.secondaryButton} onClick={() => fileInputRef.current?.focus()}>选择图片</button>}
          />
        </section>
      )}
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
