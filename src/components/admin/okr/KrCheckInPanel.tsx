"use client";

import { LoaderCircle } from "lucide-react";
import { type FormEvent } from "react";
import { useRouter } from "next/navigation";

import styles from "../../../app/admin/admin.module.css";
import { FeedbackCenter } from "../FeedbackCenter";
import { adminRequest } from "../request";
import type { KeyResultData } from "../types";
import { useAdminAction } from "../useAdminAction";
import { jsonRequest } from "../workspace-utils";
import { formatDate } from "./utils";

export function KrCheckInPanel({ keyResult }: { keyResult: KeyResultData | null }) {
  const router = useRouter();
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();

  async function recordProgress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!keyResult) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await runAction(`check-in:${keyResult.id}`, async () => {
      const progress = Number(form.get("progress"));
      await adminRequest(`/api/admin/okr/key-results/${keyResult.id}/progress`, jsonRequest("POST", keyResult.progressMode === "MANUAL"
        ? { manualProgress: progress, noteZh: form.get("noteZh") || null, noteEn: form.get("noteEn") || null }
        : { currentValue: progress, noteZh: form.get("noteZh") || null, noteEn: form.get("noteEn") || null }));
      router.refresh();
      return true;
    }, "进度已记录");
    if (result) formElement.reset();
  }

  if (!keyResult) {
    return <section className={`${styles.panel} ${styles.checkInPanel}`}><span className={styles.kicker}>QUICK CHECK-IN</span><h2>选择一个关键结果</h2><p>从左侧 KR 列表选择一项，记录进度并查看历史。</p></section>;
  }

  const currentProgress = keyResult.progressMode === "MANUAL"
    ? `${keyResult.manualProgress ?? 0}%`
    : `${keyResult.currentValue ?? 0} / ${keyResult.targetValue ?? 0}${keyResult.unit ? ` ${keyResult.unit}` : ""}`;

  return (
    <section className={`${styles.panel} ${styles.checkInPanel}`}>
      <span className={styles.kicker}>QUICK CHECK-IN</span>
      <h2>{keyResult.titleZh}</h2>
      <p className={styles.currentProgress}>当前：{currentProgress}</p>
      <form className={styles.checkInForm} onSubmit={recordProgress}>
        <label><span>{keyResult.progressMode === "MANUAL" ? "最新进度（%）" : "最新当前值"}</span><input name="progress" type="number" step="any" required min={keyResult.progressMode === "MANUAL" ? 0 : undefined} max={keyResult.progressMode === "MANUAL" ? 100 : undefined} /></label>
        <label><span>中文说明</span><textarea name="noteZh" placeholder="这次更新完成了什么？" /></label>
        <label><span>英文说明</span><textarea name="noteEn" placeholder="Optional English note" /></label>
        <button className={styles.primaryButton} disabled={isBusy(`check-in:${keyResult.id}`)}>{isBusy(`check-in:${keyResult.id}`) ? <LoaderCircle className={styles.spin} size={16} /> : null}记录进度</button>
      </form>

      <div className={styles.historyHeader}><h3>进度历史</h3><span>{keyResult.progressUpdates.length} 条</span></div>
      {keyResult.progressUpdates.length ? <ol className={styles.progressHistory}>{keyResult.progressUpdates.map((update) => (
        <li key={update.id}><div><strong>{update.calculatedProgress}%</strong><span>{update.noteZh || "未填写说明"}</span></div><time>{formatDate(update.recordedAt)}</time></li>
      ))}</ol> : <p className={styles.mutedCopy}>还没有进度记录，完成第一次 check-in 后会显示在这里。</p>}
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
