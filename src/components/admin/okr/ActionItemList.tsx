"use client";

import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

import styles from "../../../app/admin/admin.module.css";
import { ConfirmDialog } from "../ConfirmDialog";
import { FeedbackCenter } from "../FeedbackCenter";
import { adminRequest } from "../request";
import type { ActionItemData } from "../types";
import { useAdminAction } from "../useAdminAction";
import { dateValue, jsonRequest } from "../workspace-utils";
import { OkrEntityDialog } from "./OkrEntityDialog";
import { dateInput, formatDate } from "./utils";

const actionStatusLabels: Record<string, string> = { TODO: "待处理", IN_PROGRESS: "进行中", DONE: "已完成", CANCELLED: "已取消" };
const weekdayLabels = [[1, "一"], [2, "二"], [3, "三"], [4, "四"], [5, "五"], [6, "六"], [7, "日"]] as const;

export function ActionItemList({ keyResultId, items }: { keyResultId: string; items: ActionItemData[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ActionItemData | "new" | null>(null);
  const [deleting, setDeleting] = useState<ActionItemData | null>(null);
  const [checkInSuggestion, setCheckInSuggestion] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState("NONE");
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();

  async function saveAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const isEdit = editing !== "new";
    const recurrenceType = String(form.get("recurrenceType"));
    const result = await runAction("action:save", async () => {
      await adminRequest(isEdit ? `/api/admin/okr/action-items/${editing.id}` : "/api/admin/okr/action-items", jsonRequest(isEdit ? "PATCH" : "POST", {
        keyResultId,
        titleZh: form.get("titleZh"),
        titleEn: form.get("titleEn") || null,
        status: form.get("status"),
        dueDate: dateValue(form.get("dueDate")),
        sortOrder: Number(form.get("sortOrder") || 0),
        recurrenceType,
        recurrenceInterval: Number(form.get("recurrenceInterval") || 1),
        recurrenceDays: recurrenceType === "WEEKLY" ? form.getAll("recurrenceDays").map(Number) : null,
      }));
      router.refresh();
      return true;
    }, isEdit ? "行动项已更新" : "行动项已创建");
    if (result) setEditing(null);
  }

  async function updateStatus(item: ActionItemData, status: string) {
    const result = await runAction(`action:status:${item.id}`, async () => {
      await adminRequest(`/api/admin/okr/action-items/${item.id}`, jsonRequest("PATCH", { status }));
      router.refresh();
      return true;
    }, "行动项状态已更新");
    if (result && status === "DONE") setCheckInSuggestion(true);
  }

  function requestDelete(event: MouseEvent<HTMLButtonElement>, item: ActionItemData) {
    deleteTriggerRef.current = event.currentTarget;
    setDeleting(item);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const result = await runAction(`action:delete:${deleting.id}`, async () => {
      await adminRequest(`/api/admin/okr/action-items/${deleting.id}`, { method: "DELETE" });
      router.refresh();
      return true;
    }, "行动项已删除");
    if (result) setDeleting(null);
  }

  const record = editing && editing !== "new" ? editing : null;
  const selectedDays = new Set((record?.recurrenceDays ?? "").split(",").filter(Boolean).map(Number));

  return (
    <div className={styles.actionSection}>
      <div className={styles.actionSectionHeader}><div><h4>行动项</h4><span>{items.filter((item) => item.status === "DONE").length}/{items.length} 已完成</span></div><button type="button" className={styles.iconTextButton} onClick={() => { setEditing("new"); setRecurrenceType("NONE"); }}><Plus size={15} />添加</button></div>
      {checkInSuggestion ? <div className={styles.checkInSuggestion}><span>行动项已完成。建议记录一次 KR 进度，保持结果与执行同步。</span><button type="button" onClick={() => setCheckInSuggestion(false)}>知道了</button></div> : null}
      {items.length ? <div className={styles.actionList}>{items.map((item) => (
        <div className={styles.actionRow} key={item.id}>
          <span className={item.status === "DONE" ? styles.actionDone : undefined}><strong>{item.titleZh}</strong><small>{item.dueDate ? `截止 ${formatDate(item.dueDate)}` : "无截止日期"}{item.recurrenceType !== "NONE" ? ` · ${item.recurrenceType === "DAILY" ? "每日" : "每周"}重复` : ""}</small></span>
          <select aria-label={`行动项状态 ${item.titleZh}`} value={item.status} disabled={isBusy(`action:status:${item.id}`)} onChange={(event) => updateStatus(item, event.currentTarget.value)}>{Object.entries(actionStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          <div className={styles.rowActions}><button type="button" className={styles.iconButton} title="编辑行动项" aria-label={`编辑行动项 ${item.titleZh}`} onClick={() => { setEditing(item); setRecurrenceType(item.recurrenceType); }}><Pencil size={14} /></button><button type="button" className={styles.iconButton} title="删除行动项" aria-label={`删除行动项 ${item.titleZh}`} onClick={(event) => requestDelete(event, item)}><Trash2 size={14} /></button></div>
        </div>
      ))}</div> : <p className={styles.mutedCopy}>暂无行动项。添加下一步动作，但完成动作不会自动改变 KR 进度。</p>}

      <OkrEntityDialog open={Boolean(editing)} title={record ? "编辑行动项" : "添加行动项"} description="行动项帮助推进 KR，但不替代结果进度。" onClose={() => setEditing(null)}>
        <form className={styles.entityForm} onSubmit={saveAction}>
          <label><span>中文标题</span><input name="titleZh" required defaultValue={record?.titleZh ?? ""} /></label><label><span>英文标题</span><input name="titleEn" defaultValue={record?.titleEn ?? ""} /></label>
          <label><span>状态</span><select name="status" defaultValue={record?.status ?? "TODO"}>{Object.entries(actionStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>截止日期</span><input name="dueDate" type="date" defaultValue={dateInput(record?.dueDate)} /></label>
          <label><span>排序</span><input name="sortOrder" type="number" min="0" defaultValue={record?.sortOrder ?? items.length} /></label>
          <label><span>重复方式</span><select name="recurrenceType" value={recurrenceType} onChange={(event) => setRecurrenceType(event.currentTarget.value)}><option value="NONE">不重复</option><option value="DAILY">每日</option><option value="WEEKLY">每周</option></select></label>
          <label><span>重复间隔</span><input name="recurrenceInterval" type="number" min="1" max="365" defaultValue={record?.recurrenceInterval ?? 1} /></label>
          {recurrenceType === "WEEKLY" ? <fieldset className={styles.weekdayField}><legend>每周重复日期</legend>{weekdayLabels.map(([value, label]) => <label key={value}><input name="recurrenceDays" type="checkbox" value={value} defaultChecked={selectedDays.has(value)} /><span>周{label}</span></label>)}</fieldset> : null}
          <div className={styles.entityFormActions}><button type="button" onClick={() => setEditing(null)}>取消</button><button className={styles.primaryButton} disabled={isBusy("action:save")}>{isBusy("action:save") ? <LoaderCircle className={styles.spin} size={16} /> : null}{record ? "保存修改" : "创建行动项"}</button></div>
        </form>
      </OkrEntityDialog>
      <ConfirmDialog open={Boolean(deleting)} title="确认删除行动项" target={deleting?.titleZh ?? ""} description="行动项会永久删除，但 KR 进度与历史保持不变。" busy={deleting ? isBusy(`action:delete:${deleting.id}`) : false} triggerRef={deleteTriggerRef} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </div>
  );
}
