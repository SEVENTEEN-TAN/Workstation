"use client";

import {
  ArrowUpRight,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { adminRequest } from "./request";
import type { ExperienceRecordData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

type Editor = ExperienceRecordData | "new" | null;

function sortRecords(records: ExperienceRecordData[]) {
  return [...records].sort((left, right) => (
    new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime()
    || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  ));
}

function dateValue(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function text(data: FormData, name: string) {
  return String(data.get(name) ?? "");
}

function formPayload(form: HTMLFormElement) {
  const data = new FormData(form);
  const endedAt = text(data, "endedAt");
  return {
    kind: text(data, "kind"),
    organizationZh: text(data, "organizationZh"),
    organizationEn: text(data, "organizationEn"),
    titleZh: text(data, "titleZh"),
    titleEn: text(data, "titleEn"),
    descriptionZh: text(data, "descriptionZh"),
    descriptionEn: text(data, "descriptionEn"),
    locationZh: text(data, "locationZh"),
    locationEn: text(data, "locationEn"),
    linkUrl: text(data, "linkUrl"),
    startedAt: text(data, "startedAt"),
    endedAt: endedAt ? endedAt : null,
    visibility: text(data, "visibility"),
  };
}

function formatRange(record: Pick<ExperienceRecordData, "startedAt" | "endedAt">) {
  const formatter = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "UTC" });
  return `${formatter.format(new Date(record.startedAt))} - ${
    record.endedAt ? formatter.format(new Date(record.endedAt)) : "至今"
  }`;
}

export function ExperienceRecordsWorkspace({ initialRecords }: { initialRecords: ExperienceRecordData[] }) {
  const [records, setRecords] = useState(() => sortRecords(initialRecords));
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteRequest, setDeleteRequest] = useState<ExperienceRecordData | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const saveBusy = isBusy("experience:save");
  const deleteBusy = deleteRequest ? isBusy(`experience:delete:${deleteRequest.id}`) : false;

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const editing = editor !== null && editor !== "new" ? editor : null;
    const saved = await runAction("experience:save", () => adminRequest<ExperienceRecordData>(
      editing ? `/api/admin/experience/${editing.id}` : "/api/admin/experience",
      jsonRequest(editing ? "PATCH" : "POST", formPayload(event.currentTarget)),
    ), editing ? "经历记录已更新" : "经历记录已创建");
    if (!saved) return;

    setRecords((current) => sortRecords(editing
      ? current.map((item) => item.id === saved.id ? saved : item)
      : [saved, ...current]));
    setEditor(null);
  }

  async function deleteRecord() {
    if (!deleteRequest) return;
    const deleted = await runAction(`experience:delete:${deleteRequest.id}`, () => adminRequest<ExperienceRecordData>(
      `/api/admin/experience/${deleteRequest.id}`,
      { method: "DELETE" },
    ), "经历记录已删除");
    if (!deleted) return;
    setRecords((current) => current.filter((item) => item.id !== deleteRequest.id));
    setDeleteRequest(null);
  }

  const editing = editor !== null && editor !== "new" ? editor : null;

  return (
    <section>
      <PageHeader
        title="经历时间线"
        description="维护工作与教育经历，为在线简历提供可核查的职业路径。"
        action={<button type="button" className={styles.primaryButton} onClick={() => setEditor("new")} disabled={saveBusy}><Plus size={17} />新建经历</button>}
      />

      {editor ? (
        <section className={styles.panel} aria-labelledby="experience-editor-title">
          <div className={styles.sectionHeading}>
            <div><span className={styles.kicker}>{editing ? "EDIT" : "NEW"}</span><h2 id="experience-editor-title">{editing ? "编辑经历" : "新建经历"}</h2></div>
            <button type="button" className={styles.iconButton} aria-label="关闭编辑表单" onClick={() => setEditor(null)} disabled={saveBusy}><X size={18} /></button>
          </div>
          <form key={editing?.id ?? "new"} className={styles.entityForm} onSubmit={saveRecord}>
            <label><span>类型</span><select name="kind" defaultValue={editing?.kind ?? "WORK"}><option value="WORK">工作经历</option><option value="EDUCATION">教育经历</option></select></label>
            <label><span>可见性</span><select name="visibility" defaultValue={editing?.visibility ?? "PRIVATE"}><option value="PRIVATE">私密</option><option value="PUBLIC">公开</option></select></label>
            <label><span>开始日期</span><input name="startedAt" type="date" required defaultValue={dateValue(editing?.startedAt)} /></label>
            <label><span>结束日期</span><input name="endedAt" type="date" defaultValue={dateValue(editing?.endedAt)} /></label>
            <label><span>中文机构名称</span><input name="organizationZh" required maxLength={160} defaultValue={editing?.organizationZh ?? ""} /></label>
            <label><span>英文机构名称（公开必填）</span><input name="organizationEn" maxLength={160} defaultValue={editing?.organizationEn ?? ""} /></label>
            <label><span>中文职位或专业</span><input name="titleZh" required maxLength={160} defaultValue={editing?.titleZh ?? ""} /></label>
            <label><span>英文职位或专业（公开必填）</span><input name="titleEn" maxLength={160} defaultValue={editing?.titleEn ?? ""} /></label>
            <label><span>中文地点</span><input name="locationZh" maxLength={120} defaultValue={editing?.locationZh ?? ""} /></label>
            <label><span>英文地点（中文地点公开时必填）</span><input name="locationEn" maxLength={120} defaultValue={editing?.locationEn ?? ""} /></label>
            <label><span>中文经历描述</span><textarea name="descriptionZh" required maxLength={2000} defaultValue={editing?.descriptionZh ?? ""} /></label>
            <label><span>英文经历描述（公开必填）</span><textarea name="descriptionEn" maxLength={2000} defaultValue={editing?.descriptionEn ?? ""} /></label>
            <label className={styles.fullField}><span>相关链接</span><input name="linkUrl" type="url" maxLength={2048} placeholder="https://..." defaultValue={editing?.linkUrl ?? ""} /></label>
            <div className={styles.entityFormActions}>
              <button type="button" onClick={() => setEditor(null)} disabled={saveBusy}>取消</button>
              <button className={styles.primaryButton} disabled={saveBusy}>{saveBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}{saveBusy ? "保存中" : "保存经历"}</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>EXPERIENCE</span><h2>经历记录</h2></div><span>{records.length} 条</span></div>
        {records.length ? (
          <div className={styles.activityList}>{records.map((record) => (
            <article key={record.id} className={styles.activityCard}>
              <div className={styles.activityMeta}>
                <time dateTime={record.startedAt}>{formatRange(record)}</time>
                <span className={record.visibility === "PUBLIC" ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>{record.visibility === "PUBLIC" ? "公开" : "私密"}</span>
                <span className={styles.warningBadge}><GraduationCap size={12} />{record.kind === "WORK" ? "工作" : "教育"}</span>
              </div>
              <div className={styles.activityCopy}>
                <h3>{record.organizationZh} · {record.titleZh}</h3>
                <p>{record.descriptionZh}</p>
                <small>{record.organizationEn ? `${record.organizationEn} · ${record.titleEn ?? ""}` : "英文内容未完整"}</small>
              </div>
              <div className={styles.rowActions}>
                {record.linkUrl ? <a className={styles.iconTextButton} href={record.linkUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={15} />打开链接</a> : null}
                <button type="button" aria-label={`编辑经历 ${record.organizationZh}`} onClick={() => setEditor(record)}><Pencil size={15} />编辑</button>
                <button type="button" aria-label={`删除经历 ${record.organizationZh}`} onClick={() => setDeleteRequest(record)}><Trash2 size={15} />删除</button>
              </div>
            </article>
          ))}</div>
        ) : <EmptyState title="还没有经历记录" description="把工作与教育经历整理成双语记录，公开前系统会检查英文内容完整性。" action={<button type="button" className={styles.primaryButton} onClick={() => setEditor("new")}><Plus size={17} />新建经历</button>} />}
      </section>

      <ConfirmDialog open={Boolean(deleteRequest)} title="删除经历记录" target={deleteRequest ? `${deleteRequest.organizationZh} · ${deleteRequest.titleZh}` : ""} description="删除后无法恢复，公开经历页也会立即停止展示。" busy={deleteBusy} triggerRef={undefined} onConfirm={deleteRecord} onCancel={() => setDeleteRequest(null)} />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
