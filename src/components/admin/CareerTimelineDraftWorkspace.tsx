"use client";

import { FilePenLine, History, LoaderCircle, RefreshCw, Save, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { adminRequest } from "./request";
import type { CareerTimelineDraftData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { convertedActivityHref, jsonRequest } from "./workspace-utils";

const KIND_LABELS: Record<CareerTimelineDraftData["kind"], string> = {
  ARTICLE: "文章",
  PROJECT_COMPLETED: "项目完成",
  ACTIVITY: "职业动态",
  OKR_MILESTONE: "OKR 里程碑",
};

function sortDrafts(drafts: CareerTimelineDraftData[]) {
  return [...drafts].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

export function CareerTimelineDraftWorkspace({ initialDrafts }: { initialDrafts: CareerTimelineDraftData[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(() => sortDrafts(initialDrafts));
  const [editing, setEditing] = useState<CareerTimelineDraftData | null>(null);
  const [conversionNotice, setConversionNotice] = useState<string | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const saving = isBusy("timeline:save");

  async function sync() {
    const synced = await runAction("timeline:sync", () => adminRequest<CareerTimelineDraftData[]>(
      "/api/admin/timeline", { method: "POST" },
    ), "时间线草稿已同步");
    if (synced) setDrafts(sortDrafts(synced));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const saved = await runAction("timeline:save", () => adminRequest<CareerTimelineDraftData>(
      `/api/admin/timeline/${editing.id}`,
      jsonRequest("PATCH", {
        titleZh: data.get("titleZh"), titleEn: data.get("titleEn"),
        summaryZh: data.get("summaryZh"), summaryEn: data.get("summaryEn"),
      }),
    ), "时间线草稿已保存");
    if (!saved) return;
    setDrafts((current) => current.map((item) => item.id === saved.id ? saved : item));
    setEditing(null);
  }

  async function convert(draft: CareerTimelineDraftData) {
    if (editing) {
      setConversionNotice("请先保存或取消当前编辑，再转换为职业动态。");
      return;
    }
    setConversionNotice(null);
    const converted = await runAction(`timeline:convert:${draft.id}`, () => adminRequest<CareerTimelineDraftData>(
      `/api/admin/timeline/${draft.id}/convert`, { method: "POST" },
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
      <PageHeader
        title="职业时间线草稿"
        description="从已发布文章、已完成项目、手工职业动态和 OKR 里程碑中整理候选事件。同步只生成私有草稿，不会自动公开。"
        action={<button className={styles.primaryButton} type="button" onClick={sync} disabled={isBusy("timeline:sync")}>
          {isBusy("timeline:sync") ? <LoaderCircle className={styles.spin} size={17} /> : <RefreshCw size={17} />}
          {isBusy("timeline:sync") ? "同步中" : "同步时间线草稿"}
        </button>}
      />

      {editing ? (
        <section className={styles.panel} aria-labelledby="timeline-editor-title">
          <div className={styles.sectionHeading}><div><span className={styles.kicker}>EDIT</span><h2 id="timeline-editor-title">编辑时间线草稿</h2></div><FilePenLine size={18} /></div>
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
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>CAREER TIMELINE</span><h2>候选事件</h2></div><span>{drafts.length} 条</span></div>
        {conversionNotice ? <p className={styles.weeklyEditorNotice} role="status">{conversionNotice}</p> : null}
        {drafts.length ? <div className={styles.activityList}>{drafts.map((draft) => {
          const target = convertedActivityHref(draft);
          return (
          <article key={draft.id} className={styles.activityCard}>
            <div className={styles.activityMeta}>
              <time dateTime={draft.occurredAt}>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(draft.occurredAt))}</time>
              <span className={styles.statusBadge}><History size={12} />{KIND_LABELS[draft.kind]}</span>
              <span className={draft.status === "DRAFT" ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>{draft.status === "DRAFT" ? "草稿" : "已转动态"}</span>
            </div>
            <div className={styles.activityCopy}><h3>{draft.titleZh}</h3><p>{draft.summaryZh}</p>{draft.titleEn ? <small>{draft.titleEn}</small> : null}</div>
            <div className={styles.rowActions}>
              {draft.status === "DRAFT" ? <button type="button" onClick={() => setEditing(draft)}><FilePenLine size={15} />编辑</button> : null}
              {draft.status === "DRAFT" ? <button type="button" onClick={() => convert(draft)} disabled={isBusy(`timeline:convert:${draft.id}`)}><Send size={15} />转为私有职业动态</button> : null}
              {target ? <Link href={target} onClick={(event) => {
                if (!editing) return;
                event.preventDefault();
                setConversionNotice("请先保存或取消当前编辑，再打开职业动态。");
              }}>打开动态 {draft.convertedActivityId}</Link> : null}
            </div>
          </article>
          );
        })}</div> : <EmptyState title="还没有时间线草稿" description="同步后会从文章、已完成项目、手工职业动态和 OKR 里程碑中生成候选事件。" action={null} />}
      </section>

      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
