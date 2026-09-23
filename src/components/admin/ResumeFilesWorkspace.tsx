"use client";

import { Download, EyeOff, Eye, FileText, LoaderCircle, RefreshCw, Trash2, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { getResumeFilePublicIssues } from "../../lib/public-readiness";
import { ConfirmDialog } from "./ConfirmDialog";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { PublicReadiness } from "./okr/PublicReadiness";
import { adminRequest } from "./request";
import type { ResumeFileData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

const SLOTS = [
  { locale: "ZH" as const, title: "中文简历", description: "面向中文岗位与合作场景。", publicPath: "/api/resume/zh" },
  { locale: "EN" as const, title: "English Resume", description: "For international roles and collaborations.", publicPath: "/api/resume/en" },
];

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ResumeFilesWorkspace({ initialFiles }: { initialFiles: ResumeFileData[] }) {
  const [files, setFiles] = useState(initialFiles);
  const [deleteRequest, setDeleteRequest] = useState<ResumeFileData | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();

  function upsert(next: ResumeFileData) {
    setFiles((current) => [...current.filter((item) => item.locale !== next.locale), next]);
  }

  async function upload(locale: "ZH" | "EN", event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    const file = body.get("file");
    if (!(file instanceof File) || !file.size) return;

    const saved = await runAction(`resume:upload:${locale}`, () => adminRequest<ResumeFileData>(
      "/api/admin/resume",
      { method: "POST", body },
    ), files.some((item) => item.locale === locale) ? "简历文件已替换" : "简历文件已上传");
    if (!saved) return;
    upsert(saved);
    form.reset();
  }

  async function toggleVisibility(file: ResumeFileData) {
    const visibility = file.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC";
    const saved = await runAction(`resume:visibility:${file.id}`, () => adminRequest<ResumeFileData>(
      `/api/admin/resume/${file.id}`,
      jsonRequest("PATCH", { visibility }),
    ), visibility === "PUBLIC" ? "简历已公开" : "简历已设为私密");
    if (saved) upsert(saved);
  }

  async function deleteFile() {
    if (!deleteRequest) return;
    const deleted = await runAction(`resume:delete:${deleteRequest.id}`, () => adminRequest<{ id: string }>(
      `/api/admin/resume/${deleteRequest.id}`,
      { method: "DELETE" },
    ), "简历文件已删除");
    if (!deleted) return;
    setFiles((current) => current.filter((item) => item.id !== deleted.id));
    setDeleteRequest(null);
  }

  return (
    <section>
      <PageHeader
        title="简历管理"
        description="维护中英文 PDF 下载文件；在线打印版简历继续读取已公开的职业证据。"
        action={<a className={styles.iconTextButton} href="/resume" target="_blank" rel="noreferrer"><FileText size={17} />预览打印版</a>}
      />

      <div className={styles.resumeFileGrid}>
        {SLOTS.map((slot) => {
          const file = files.find((item) => item.locale === slot.locale);
          const uploadBusy = isBusy(`resume:upload:${slot.locale}`);
          const visibilityBusy = file ? isBusy(`resume:visibility:${file.id}`) : false;
          return (
            <section key={slot.locale} className={styles.resumeFileCard} aria-labelledby={`resume-${slot.locale.toLowerCase()}-title`}>
              <div className={styles.sectionHeading}>
                <div><span className={styles.kicker}>{slot.locale}</span><h2 id={`resume-${slot.locale.toLowerCase()}-title`}>{slot.title}</h2></div>
                <span className={file?.visibility === "PUBLIC" ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>{file ? file.visibility === "PUBLIC" ? "公开" : "私密" : "未上传"}</span>
              </div>
              <p>{slot.description}</p>

              {file ? (
                <div className={styles.resumeFileMeta}>
                  <FileText size={22} aria-hidden="true" />
                  <div><strong>{file.originalFilename}</strong><small>{formatSize(file.sizeBytes)} · 更新于 {formatDate(file.updatedAt)}</small></div>
                </div>
              ) : (
                <div className={styles.resumeFileMeta}>
                  <FileText size={22} aria-hidden="true" />
                  <div><strong>尚未上传</strong><small>上传后默认保持私密，确认内容后再公开。</small></div>
                </div>
              )}
              <PublicReadiness issues={getResumeFilePublicIssues(file)} />

              <form className={styles.resumeUploadForm} onSubmit={(event) => upload(slot.locale, event)}>
                <input name="locale" type="hidden" value={slot.locale} />
                <label className={styles.fileInput}><span>{file ? "选择替换文件" : "选择 PDF 文件"}</span><input name="file" type="file" accept=".pdf,application/pdf" required disabled={uploadBusy} /></label>
                <small>仅支持 PDF，最大 10 MB。</small>
                <button className={styles.primaryButton} disabled={uploadBusy}>{uploadBusy ? <LoaderCircle className={styles.spin} size={17} /> : file ? <RefreshCw size={17} /> : <Upload size={17} />}{uploadBusy ? "上传中" : file ? "替换文件" : "上传文件"}</button>
              </form>

              {file ? (
                <div className={styles.rowActions}>
                  <button type="button" onClick={() => toggleVisibility(file)} disabled={visibilityBusy}>{visibilityBusy ? <LoaderCircle className={styles.spin} size={16} /> : file.visibility === "PUBLIC" ? <EyeOff size={16} /> : <Eye size={16} />}{file.visibility === "PUBLIC" ? "设为私密" : "公开下载"}</button>
                  {file.visibility === "PUBLIC" ? <a className={styles.iconTextButton} href={slot.publicPath}><Download size={16} />下载验证</a> : null}
                  <button type="button" className={styles.dangerButton} onClick={() => setDeleteRequest(file)}><Trash2 size={16} />删除</button>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(deleteRequest)}
        title="删除简历文件"
        target={deleteRequest?.originalFilename ?? ""}
        description="删除后公开下载将立即失效，且文件无法恢复。"
        busy={deleteRequest ? isBusy(`resume:delete:${deleteRequest.id}`) : false}
        triggerRef={undefined}
        onConfirm={deleteFile}
        onCancel={() => setDeleteRequest(null)}
      />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
