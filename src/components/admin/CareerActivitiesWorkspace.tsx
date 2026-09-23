"use client";

import { ExternalLink, LoaderCircle, Pencil, Plus, Save, Star, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { getCareerActivityPublicIssues } from "../../lib/public-readiness";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { PublicReadiness } from "./okr/PublicReadiness";
import { adminRequest } from "./request";
import type { CareerActivityData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

type Editor = CareerActivityData | "new" | null;

function sortActivities(items: CareerActivityData[]) {
  return [...items].sort((left, right) => Number(right.featured) - Number(left.featured)
    || new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

function dateTimeValue(value?: string) {
  const date = value ? new Date(value) : new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formPayload(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    titleZh: data.get("titleZh"),
    titleEn: data.get("titleEn"),
    summaryZh: data.get("summaryZh"),
    summaryEn: data.get("summaryEn"),
    occurredAt: new Date(String(data.get("occurredAt"))).toISOString(),
    visibility: data.get("visibility"),
    featured: data.get("featured") === "on",
    linkUrl: data.get("linkUrl"),
  };
}

export function CareerActivitiesWorkspace({ initialActivities, targetActivityId = null }: { initialActivities: CareerActivityData[]; targetActivityId?: string | null }) {
  const initialTarget = initialActivities.find((item) => item.id === targetActivityId);
  const [activities, setActivities] = useState(() => sortActivities(initialActivities));
  const [editor, setEditor] = useState<Editor>(initialTarget ?? null);
  const [deleteRequest, setDeleteRequest] = useState<CareerActivityData | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const saveBusy = isBusy("activities:save");
  const deleteBusy = deleteRequest ? isBusy(`activities:delete:${deleteRequest.id}`) : false;

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editing = editor !== null && editor !== "new" ? editor : null;
    const saved = await runAction("activities:save", () => adminRequest<CareerActivityData>(
      editing ? `/api/admin/activities/${editing.id}` : "/api/admin/activities",
      jsonRequest(editing ? "PATCH" : "POST", formPayload(event.currentTarget)),
    ), editing ? "职业动态已更新" : "职业动态已创建");
    if (!saved) return;
    setActivities((current) => sortActivities(editing
      ? current.map((item) => item.id === saved.id ? saved : item)
      : [saved, ...current]));
    setEditor(null);
  }

  async function deleteActivity() {
    if (!deleteRequest) return;
    const deleted = await runAction(`activities:delete:${deleteRequest.id}`, () => adminRequest<CareerActivityData>(
      `/api/admin/activities/${deleteRequest.id}`,
      { method: "DELETE" },
    ), "职业动态已删除");
    if (!deleted) return;
    setActivities((current) => current.filter((item) => item.id !== deleteRequest.id));
    setDeleteRequest(null);
  }

  const editing = editor !== null && editor !== "new" ? editor : null;

  return (
    <section>
      <PageHeader
        title="职业动态"
        description="维护对外展示的近期进展、发布记录与职业里程碑。"
        action={<button type="button" className={styles.primaryButton} onClick={() => setEditor("new")} disabled={saveBusy}><Plus size={17} />新建动态</button>}
      />

      {targetActivityId && !initialTarget ? <p role="status">未找到目标动态，请从下方列表选择。</p> : null}

      {editor ? (
        <section className={styles.panel} aria-labelledby="activity-editor-title">
          <div className={styles.sectionHeading}>
            <div><span className={styles.kicker}>{editing ? "EDIT" : "NEW"}</span><h2 id="activity-editor-title">{editing ? "编辑职业动态" : "新建职业动态"}</h2></div>
            <button type="button" className={styles.iconButton} aria-label="关闭编辑表单" onClick={() => setEditor(null)} disabled={saveBusy}><X size={18} /></button>
          </div>
          <form key={editing?.id ?? "new"} className={styles.entityForm} onSubmit={saveActivity}>
            <label><span>中文标题</span><input name="titleZh" required maxLength={120} defaultValue={editing?.titleZh ?? ""} /></label>
            <label><span>英文标题</span><input name="titleEn" maxLength={120} defaultValue={editing?.titleEn ?? ""} /></label>
            <label><span>中文摘要</span><textarea name="summaryZh" required maxLength={1000} defaultValue={editing?.summaryZh ?? ""} /></label>
            <label><span>英文摘要</span><textarea name="summaryEn" maxLength={1000} defaultValue={editing?.summaryEn ?? ""} /></label>
            <label><span>发生时间</span><input name="occurredAt" type="datetime-local" required defaultValue={dateTimeValue(editing?.occurredAt)} /></label>
            <label><span>可见性</span><select name="visibility" defaultValue={editing?.visibility ?? "PRIVATE"}><option value="PRIVATE">私密</option><option value="PUBLIC">公开</option></select></label>
            <label className={styles.fullField}><span>相关链接</span><input name="linkUrl" type="url" maxLength={2048} placeholder="https://..." defaultValue={editing?.linkUrl ?? ""} /></label>
            <label className={`${styles.fullField} ${styles.activityToggle}`}><input name="featured" type="checkbox" defaultChecked={editing?.featured ?? false} /><span><strong>设为精选</strong><small>精选动态会优先显示在公开时间线顶部。</small></span></label>
            <div className={styles.entityFormActions}>
              <button type="button" onClick={() => setEditor(null)} disabled={saveBusy}>取消</button>
              <button className={styles.primaryButton} disabled={saveBusy}>{saveBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}{saveBusy ? "保存中" : "保存动态"}</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>CAREER FEED</span><h2>动态记录</h2></div><span>{activities.length} 条</span></div>
        {activities.length ? (
          <div className={styles.activityList}>{activities.map((activity) => (
            <article key={activity.id} className={styles.activityCard}>
              <div className={styles.activityMeta}>
                <time dateTime={activity.occurredAt}>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(activity.occurredAt))}</time>
                <span className={activity.visibility === "PUBLIC" ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>{activity.visibility === "PUBLIC" ? "公开" : "私密"}</span>
                {activity.featured ? <span className={styles.warningBadge}><Star size={12} />精选</span> : null}
              </div>
              <div className={styles.activityCopy}><h3>{activity.titleZh}</h3><p>{activity.summaryZh}</p>{activity.titleEn ? <small>{activity.titleEn}</small> : null}<PublicReadiness issues={getCareerActivityPublicIssues(activity)} /></div>
              <div className={styles.rowActions}>
                {activity.linkUrl ? <a className={styles.iconTextButton} href={activity.linkUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />打开链接</a> : null}
                <button type="button" aria-label={`编辑动态 ${activity.titleZh}`} onClick={() => setEditor(activity)}><Pencil size={15} />编辑</button>
                <button type="button" aria-label={`删除动态 ${activity.titleZh}`} onClick={() => setDeleteRequest(activity)}><Trash2 size={15} />删除</button>
              </div>
            </article>
          ))}</div>
        ) : <EmptyState title="还没有职业动态" description="记录最近完成的工作、发布内容或重要进展。" action={<button type="button" className={styles.primaryButton} onClick={() => setEditor("new")}><Plus size={17} />新建动态</button>} />}
      </section>

      <ConfirmDialog open={Boolean(deleteRequest)} title="删除职业动态" target={deleteRequest?.titleZh ?? ""} description="删除后无法恢复，公开页面也会立即停止展示。" busy={deleteBusy} triggerRef={undefined} onConfirm={deleteActivity} onCancel={() => setDeleteRequest(null)} />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
