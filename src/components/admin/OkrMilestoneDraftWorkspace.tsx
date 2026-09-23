"use client";

import { FilePenLine, Flag, LoaderCircle, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { adminRequest } from "./request";
import type { OkrMilestoneDraftData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { convertedActivityHref, jsonRequest } from "./workspace-utils";

const KIND_LABELS: Record<OkrMilestoneDraftData["kind"], string> = {
  KR_PROGRESS: "进度里程碑",
  KEY_RESULT_COMPLETED: "KR 已完成",
  OBJECTIVE_COMPLETED: "目标已完成",
};

function sortDrafts(drafts: OkrMilestoneDraftData[]) {
  return [...drafts].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

export function OkrMilestoneDraftWorkspace({ initialDrafts }: { initialDrafts: OkrMilestoneDraftData[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(() => sortDrafts(initialDrafts));
  const [editing, setEditing] = useState<OkrMilestoneDraftData | null>(null);
  const [conversionNotice, setConversionNotice] = useState<string | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const saving = isBusy("milestones:save");
  const converting = drafts.some((draft) => isBusy(`milestones:convert:${draft.id}`));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const saved = await runAction("milestones:save", () => adminRequest<OkrMilestoneDraftData>(
      `/api/admin/milestones/${editing.id}`,
      jsonRequest("PATCH", {
        titleZh: data.get("titleZh"), titleEn: data.get("titleEn"),
        summaryZh: data.get("summaryZh"), summaryEn: data.get("summaryEn"),
      }),
    ), "里程碑草稿已保存");
    if (!saved) return;
    setDrafts((current) => current.map((item) => item.id === saved.id ? saved : item));
    setEditing(null);
  }

  async function convert(draft: OkrMilestoneDraftData) {
    if (editing || converting) {
      setConversionNotice("请先保存或取消当前编辑，再转换为职业动态。");
      return;
    }
    setConversionNotice(null);
    const converted = await runAction(`milestones:convert:${draft.id}`, () => adminRequest<OkrMilestoneDraftData>(
      `/api/admin/milestones/${draft.id}/convert`, { method: "POST" },
    ));
    if (!converted) return;
    const target = convertedActivityHref(converted);
    if (!target) {
      setConversionNotice("转换响应缺少可打开的动态，请检查草稿状态后重试。");
      return;
    }
    setDrafts((current) => current.map((item) => item.id === converted.id ? converted : item));
    router.push(target);
  }

  return (
    <section>
      <PageHeader title="里程碑草稿" description="在关键进度跨越阈值或 OKR 完成时自动生成，确认后再转入职业动态。OKR 更新时自动生成，不会自动公开。" />

      {editing ? (
        <section className={styles.panel} aria-labelledby="milestone-editor-title">
          <div className={styles.sectionHeading}><div><span className={styles.kicker}>EDIT</span><h2 id="milestone-editor-title">编辑里程碑草稿</h2></div><FilePenLine size={18} /></div>
          <form key={editing.id} className={styles.entityForm} onSubmit={save}>
            <label><span>中文标题</span><input name="titleZh" required maxLength={120} defaultValue={editing.titleZh} /></label>
            <label><span>英文标题</span><input name="titleEn" maxLength={120} defaultValue={editing.titleEn} /></label>
            <label><span>中文摘要</span><textarea name="summaryZh" required maxLength={4000} defaultValue={editing.summaryZh} /></label>
            <label><span>英文摘要</span><textarea name="summaryEn" maxLength={4000} defaultValue={editing.summaryEn} /></label>
            <div className={styles.entityFormActions}>
              <button type="button" onClick={() => setEditing(null)} disabled={saving}>取消</button>
              <button className={styles.primaryButton} disabled={saving}>{saving ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}{saving ? "保存中" : "保存草稿"}</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>OKR MILESTONES</span><h2>自动生成记录</h2></div><span>{drafts.length} 条</span></div>
        {conversionNotice ? <p className={styles.weeklyEditorNotice} role="status">{conversionNotice}</p> : null}
        {drafts.length ? <div className={styles.activityList}>{drafts.map((draft) => {
          const target = convertedActivityHref(draft);
          return (
          <article key={draft.id} className={styles.activityCard}>
            <div className={styles.activityMeta}>
              <time dateTime={draft.occurredAt}>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(draft.occurredAt))}</time>
              <span className={styles.statusBadge}><Flag size={12} />{KIND_LABELS[draft.kind]}</span>
              <span className={draft.status === "DRAFT" ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>{draft.status === "DRAFT" ? "草稿" : "已转动态"}</span>
            </div>
            <div className={styles.activityCopy}><h3>{draft.titleZh}</h3><p>{draft.summaryZh}</p>{draft.titleEn ? <small>{draft.titleEn}</small> : null}</div>
            <div className={styles.rowActions}>
              {draft.status === "DRAFT" ? <button type="button" onClick={() => setEditing(draft)} disabled={converting}><FilePenLine size={15} />编辑</button> : null}
              {draft.status === "DRAFT" ? <button type="button" onClick={() => convert(draft)} disabled={converting}><Send size={15} />转为私有职业动态</button> : null}
              {target ? <Link href={target} onClick={(event) => {
                if (!editing) return;
                event.preventDefault();
                setConversionNotice("请先保存或取消当前编辑，再打开职业动态。");
              }}>打开动态 {draft.convertedActivityId}</Link> : null}
            </div>
          </article>
          );
        })}</div> : <EmptyState title="还没有里程碑草稿" description="KR 进度跨越 25%、50%、75%，或 KR / Objective 首次完成时会自动生成。" action={null} />}
      </section>

      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
