"use client";

import Link from "next/link";
import { Filter, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

import styles from "../../../app/admin/admin.module.css";
import { getCyclePublicIssues } from "../../../lib/okr/public-readiness";
import { ConfirmDialog } from "../ConfirmDialog";
import { EmptyState } from "../EmptyState";
import { FeedbackCenter } from "../FeedbackCenter";
import { PageHeader } from "../PageHeader";
import { adminRequest } from "../request";
import type { OkrCycleData } from "../types";
import { useAdminAction } from "../useAdminAction";
import { dateValue, jsonRequest } from "../workspace-utils";
import { OkrEntityDialog } from "./OkrEntityDialog";
import { PublicReadiness } from "./PublicReadiness";
import { cycleStatusLabels, dateInput, formatDate, getCycleSummary } from "./utils";

type EditorState = { mode: "create" } | { mode: "edit"; cycle: OkrCycleData };

export function OkrCycleListWorkspace({ initialCycles }: { initialCycles: OkrCycleData[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [visibilityFilter, setVisibilityFilter] = useState("ALL");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteCycle, setDeleteCycle] = useState<OkrCycleData | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();

  const cycles = useMemo(() => initialCycles.filter((cycle) => (
    (statusFilter === "ALL" || cycle.status === statusFilter)
    && (visibilityFilter === "ALL" || cycle.visibility === visibilityFilter)
  )), [initialCycles, statusFilter, visibilityFilter]);

  async function saveCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const form = new FormData(event.currentTarget);
    const editing = editor.mode === "edit";
    const path = editing ? `/api/admin/okr/cycles/${editor.cycle.id}` : "/api/admin/okr/cycles";
    const result = await runAction("okr:save-cycle", async () => {
      await adminRequest(path, jsonRequest(editing ? "PATCH" : "POST", {
        nameZh: form.get("nameZh"),
        nameEn: form.get("nameEn") || null,
        type: form.get("type"),
        startDate: dateValue(form.get("startDate")),
        endDate: dateValue(form.get("endDate")),
        status: form.get("status"),
        visibility: form.get("visibility"),
      }));
      router.refresh();
      return true;
    }, editing ? "周期已更新" : "周期已创建");
    if (result) setEditor(null);
  }

  function requestDelete(event: MouseEvent<HTMLButtonElement>, cycle: OkrCycleData) {
    deleteTriggerRef.current = event.currentTarget;
    setDeleteCycle(cycle);
  }

  async function confirmDelete() {
    if (!deleteCycle) return;
    const result = await runAction(`okr:delete-cycle:${deleteCycle.id}`, async () => {
      await adminRequest(`/api/admin/okr/cycles/${deleteCycle.id}`, { method: "DELETE" });
      router.refresh();
      return true;
    }, "周期已删除");
    if (result) setDeleteCycle(null);
  }

  const editingCycle = editor?.mode === "edit" ? editor.cycle : null;
  const activeCount = initialCycles.filter((cycle) => cycle.status === "ACTIVE").length;
  const reviewPending = initialCycles.filter((cycle) => cycle.status === "COMPLETED" && !cycle.reviews.some((review) => !review.objectiveId)).length;

  return (
    <section>
      <PageHeader title="OKR 执行工作台" description="按周期组织目标，在独立页面完成拆解、执行、进度记录与复盘。" action={<button type="button" className={styles.primaryButton} onClick={() => setEditor({ mode: "create" })}><Plus size={18} />新建周期</button>} />

      <div className={styles.metrics}>
        <article><span>全部周期</span><strong>{initialCycles.length}</strong></article>
        <article><span>进行中</span><strong>{activeCount}</strong></article>
        <article><span>待复盘</span><strong>{reviewPending}</strong></article>
        <article><span>满足展示条件的周期</span><strong>{initialCycles.filter((cycle) => getCyclePublicIssues(cycle).length === 0).length}</strong></article>
      </div>

      <section className={`${styles.panel} ${styles.okrFilterBar}`}>
        <div className={styles.filterTitle}><Filter size={17} /><strong>筛选周期</strong></div>
        <label><span>状态</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)}><option value="ALL">全部</option>{Object.entries(cycleStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>可见性</span><select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.currentTarget.value)}><option value="ALL">全部</option><option value="PRIVATE">私密</option><option value="PUBLIC">公开</option></select></label>
      </section>

      {cycles.length ? <div className={styles.cycleGrid}>{cycles.map((cycle) => {
        const summary = getCycleSummary(cycle);
        return (
          <article className={styles.cycleCard} key={cycle.id}>
            <div className={styles.entityHead}>
              <div><span className={styles.kicker}>{cycle.type} · {cycle.visibility}</span><h2>{cycle.nameZh}</h2><small>{formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}</small></div>
              <span className={`${styles.statusBadge} ${cycle.status === "ACTIVE" ? styles.statusActive : ""}`}>{cycleStatusLabels[cycle.status] ?? cycle.status}</span>
            </div>
            <div className={styles.cycleProgress}><div><i style={{ width: `${summary.progress}%` }} /></div><strong>{summary.progress}%</strong></div>
            <div className={styles.cycleStats}><span>{summary.counts.objectives} 个目标</span><span>{summary.counts.keyResults} 个 KR</span><span>{summary.counts.atRisk} 个风险项</span></div>
            <PublicReadiness issues={getCyclePublicIssues(cycle)} />
            <div className={styles.cardActions}>
              <Link className={styles.primaryButton} href={`/admin/okr/cycles/${cycle.id}`}>进入周期</Link>
              <button type="button" className={styles.iconButton} title="编辑周期" aria-label={`编辑周期 ${cycle.nameZh}`} onClick={() => setEditor({ mode: "edit", cycle })}><Pencil size={17} /></button>
              <button type="button" className={styles.iconButton} title="删除周期" aria-label={`删除周期 ${cycle.nameZh}`} onClick={(event) => requestDelete(event, cycle)}><Trash2 size={17} /></button>
            </div>
          </article>
        );
      })}</div> : <section className={styles.panel}><EmptyState title="没有符合条件的周期" description="调整筛选条件，或建立一个新的 OKR 周期。" action={<button type="button" className={styles.secondaryButton} onClick={() => setEditor({ mode: "create" })}>新建周期</button>} /></section>}

      <OkrEntityDialog open={Boolean(editor)} title={editingCycle ? "编辑周期" : "新建周期"} description="周期负责统一目标范围、时间和公开状态。" onClose={() => setEditor(null)}>
        <form className={styles.entityForm} onSubmit={saveCycle}>
          <label><span>中文名称</span><input name="nameZh" required defaultValue={editingCycle?.nameZh ?? ""} /></label>
          <label><span>英文名称（公开必填）</span><input name="nameEn" defaultValue={editingCycle?.nameEn ?? ""} /></label>
          <label><span>周期类型</span><select name="type" defaultValue={editingCycle?.type ?? "QUARTER"}><option value="QUARTER">季度</option><option value="YEAR">年度</option><option value="CUSTOM">自定义</option></select></label>
          <label><span>状态</span><select name="status" defaultValue={editingCycle?.status ?? "DRAFT"}>{Object.entries(cycleStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>开始日期</span><input name="startDate" type="date" required defaultValue={dateInput(editingCycle?.startDate)} /></label>
          <label><span>结束日期</span><input name="endDate" type="date" required defaultValue={dateInput(editingCycle?.endDate)} /></label>
          <label><span>可见性</span><select name="visibility" defaultValue={editingCycle?.visibility ?? "PRIVATE"}><option value="PRIVATE">私密</option><option value="PUBLIC">公开</option></select></label>
          <div className={styles.entityFormActions}><button type="button" onClick={() => setEditor(null)}>取消</button><button className={styles.primaryButton} disabled={isBusy("okr:save-cycle")}>{isBusy("okr:save-cycle") ? <LoaderCircle className={styles.spin} size={16} /> : null}{editingCycle ? "保存修改" : "创建周期"}</button></div>
        </form>
      </OkrEntityDialog>

      <ConfirmDialog open={Boolean(deleteCycle)} title="确认删除周期" target={deleteCycle?.nameZh ?? ""} description="周期内的目标、KR、行动项、进度记录与复盘都会删除。" busy={deleteCycle ? isBusy(`okr:delete-cycle:${deleteCycle.id}`) : false} triggerRef={deleteTriggerRef} onConfirm={confirmDelete} onCancel={() => setDeleteCycle(null)} />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
