"use client";

import Link from "next/link";
import { ArrowLeft, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

import styles from "../../../app/admin/admin.module.css";
import { ConfirmDialog } from "../ConfirmDialog";
import { EmptyState } from "../EmptyState";
import { FeedbackCenter } from "../FeedbackCenter";
import { PageHeader } from "../PageHeader";
import { adminRequest } from "../request";
import type { KeyResultData, ObjectiveDetailData } from "../types";
import { useAdminAction } from "../useAdminAction";
import { dateValue, jsonRequest } from "../workspace-utils";
import { ActionItemList } from "./ActionItemList";
import { KrCheckInPanel } from "./KrCheckInPanel";
import { OkrEntityDialog } from "./OkrEntityDialog";
import { dateInput, getObjectiveSummary, objectiveStatusLabels } from "./utils";

type EditorState = { kind: "objective" } | { kind: "kr"; record?: KeyResultData };

export function ObjectiveWorkspace({ initialObjective }: { initialObjective: ObjectiveDetailData }) {
  const router = useRouter();
  const objective = initialObjective;
  const [selectedKrId, setSelectedKrId] = useState<string | null>(objective.keyResults[0]?.id ?? null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deletingKr, setDeletingKr] = useState<KeyResultData | null>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const summary = getObjectiveSummary(objective, objective.cycle.endDate);
  const selectedKr = objective.keyResults.find((keyResult) => keyResult.id === selectedKrId) ?? objective.keyResults[0] ?? null;

  async function saveObjective(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await runAction("objective:save", async () => {
      await adminRequest(`/api/admin/okr/objectives/${objective.id}`, jsonRequest("PATCH", {
        titleZh: form.get("titleZh"), titleEn: form.get("titleEn") || null,
        descriptionZh: form.get("descriptionZh") || null, descriptionEn: form.get("descriptionEn") || null,
        status: form.get("status"), visibility: form.get("visibility"), sortOrder: Number(form.get("sortOrder") || 0),
        startDate: dateValue(form.get("startDate")), endDate: dateValue(form.get("endDate")),
      }));
      router.refresh(); return true;
    }, "目标已更新");
    if (result) setEditor(null);
  }

  async function saveKeyResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editor?.kind !== "kr") return;
    const form = new FormData(event.currentTarget);
    const record = editor.record;
    const mode = String(form.get("progressMode"));
    const result = await runAction("kr:save", async () => {
      await adminRequest(record ? `/api/admin/okr/key-results/${record.id}` : "/api/admin/okr/key-results", jsonRequest(record ? "PATCH" : "POST", {
        objectiveId: objective.id,
        titleZh: form.get("titleZh"), titleEn: form.get("titleEn") || null,
        descriptionZh: form.get("descriptionZh") || null, descriptionEn: form.get("descriptionEn") || null,
        progressMode: mode,
        startValue: mode === "METRIC" ? Number(form.get("startValue")) : null,
        currentValue: mode === "METRIC" ? Number(form.get("currentValue")) : null,
        targetValue: mode === "METRIC" ? Number(form.get("targetValue")) : null,
        manualProgress: mode === "MANUAL" ? Number(form.get("manualProgress")) : null,
        unit: form.get("unit") || null,
        weight: Number(form.get("weight") || 1), status: form.get("status"), sortOrder: Number(form.get("sortOrder") || 0),
      }));
      router.refresh(); return true;
    }, record ? "关键结果已更新" : "关键结果已创建");
    if (result) setEditor(null);
  }

  async function updateKeyResultStatus(keyResult: KeyResultData, status: string) {
    await runAction(`kr:status:${keyResult.id}`, async () => {
      await adminRequest(`/api/admin/okr/key-results/${keyResult.id}`, jsonRequest("PATCH", { status }));
      router.refresh();
      return true;
    }, "关键结果状态已更新");
  }

  function requestDelete(event: MouseEvent<HTMLButtonElement>, keyResult: KeyResultData) {
    deleteTriggerRef.current = event.currentTarget;
    setDeletingKr(keyResult);
  }

  async function confirmDelete() {
    if (!deletingKr) return;
    const result = await runAction(`kr:delete:${deletingKr.id}`, async () => {
      await adminRequest(`/api/admin/okr/key-results/${deletingKr.id}`, { method: "DELETE" });
      router.refresh(); return true;
    }, "关键结果已删除");
    if (result) { if (selectedKrId === deletingKr.id) setSelectedKrId(null); setDeletingKr(null); }
  }

  const krRecord = editor?.kind === "kr" ? editor.record : undefined;

  return (
    <section>
      <Link className={styles.backLink} href={`/admin/okr/cycles/${objective.cycle.id}`}><ArrowLeft size={16} />返回 {objective.cycle.nameZh}</Link>
      <PageHeader title={objective.titleZh} description={objective.descriptionZh || "围绕这个 Objective 管理关键结果、执行动作与进度历史。"} action={<div className={styles.actions}><button type="button" onClick={() => setEditor({ kind: "objective" })}><Pencil size={17} />编辑目标</button><button type="button" className={styles.primaryButton} onClick={() => setEditor({ kind: "kr" })}><Plus size={18} />添加 KR</button></div>} />

      <div className={styles.metrics}><article><span>目标进度</span><strong>{summary.progress}%</strong></article><article><span>关键结果</span><strong>{summary.counts.total}</strong></article><article><span>已完成</span><strong>{summary.counts.completed}</strong></article><article><span>风险项</span><strong>{summary.counts.atRisk}</strong></article></div>

      <div className={styles.objectiveWorkspaceGrid}>
        <section className={styles.panel}>
          <div className={styles.sectionHeading}><div><span className={styles.kicker}>KEY RESULTS</span><h2>关键结果与行动项</h2></div></div>
          {objective.keyResults.length ? <div className={styles.krExecutionList}>{objective.keyResults.map((keyResult, index) => {
            const state = summary.keyResults[index];
            return (
              <article className={`${styles.krExecutionCard} ${selectedKr?.id === keyResult.id ? styles.krSelected : ""}`} key={keyResult.id}>
                <button type="button" className={styles.krSelectButton} onClick={() => setSelectedKrId(keyResult.id)}>
                  <span><strong>{keyResult.titleZh}</strong><small>{keyResult.progressMode === "MANUAL" ? `${keyResult.manualProgress ?? 0}%` : `${keyResult.currentValue ?? 0} / ${keyResult.targetValue ?? 0}`} · 权重 {keyResult.weight}</small></span>
                  <b>{state.progress}%</b>
                </button>
                <div className={styles.riskBadges}>{state.overdue ? <span className={styles.riskBadge}>已逾期</span> : null}{state.stale ? <span className={styles.warningBadge}>长期未更新</span> : null}{state.atRisk ? <span className={styles.riskBadge}>有风险</span> : null}</div>
                <div className={styles.krCardActions}><select aria-label={`KR 状态 ${keyResult.titleZh}`} value={keyResult.status} disabled={isBusy(`kr:status:${keyResult.id}`)} onChange={(event) => updateKeyResultStatus(keyResult, event.currentTarget.value)}>{Object.entries(objectiveStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button type="button" className={styles.iconButton} title="编辑 KR" aria-label={`编辑 KR ${keyResult.titleZh}`} onClick={() => setEditor({ kind: "kr", record: keyResult })}><Pencil size={15} /></button><button type="button" className={styles.iconButton} title="删除 KR" aria-label={`删除 KR ${keyResult.titleZh}`} onClick={(event) => requestDelete(event, keyResult)}><Trash2 size={15} /></button></div>
                <ActionItemList keyResultId={keyResult.id} items={keyResult.actionItems} />
              </article>
            );
          })}</div> : <EmptyState title="还没有关键结果" description="添加第一个可衡量的 KR，再用行动项推进执行。" action={<button type="button" onClick={() => setEditor({ kind: "kr" })}>添加 KR</button>} />}
        </section>
        <KrCheckInPanel keyResult={selectedKr} />
      </div>

      <OkrEntityDialog open={editor?.kind === "objective"} title="编辑 Objective" description="调整目标说明、周期内时间范围和公开状态。" onClose={() => setEditor(null)}>
        <form className={styles.entityForm} onSubmit={saveObjective}><label><span>中文标题</span><input name="titleZh" required defaultValue={objective.titleZh} /></label><label><span>英文标题（公开必填）</span><input name="titleEn" defaultValue={objective.titleEn ?? ""} /></label><label className={styles.fullField}><span>中文说明</span><textarea name="descriptionZh" defaultValue={objective.descriptionZh ?? ""} /></label><label className={styles.fullField}><span>英文说明（中文填写时公开必填）</span><textarea name="descriptionEn" defaultValue={objective.descriptionEn ?? ""} /></label><label><span>状态</span><select name="status" defaultValue={objective.status}>{Object.entries(objectiveStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>可见性</span><select name="visibility" defaultValue={objective.visibility}><option value="PRIVATE">私密</option><option value="PUBLIC">公开</option></select></label><label><span>开始日期</span><input name="startDate" type="date" defaultValue={dateInput(objective.startDate)} /></label><label><span>结束日期</span><input name="endDate" type="date" defaultValue={dateInput(objective.endDate)} /></label><label><span>排序</span><input name="sortOrder" type="number" min="0" defaultValue={objective.sortOrder} /></label><div className={styles.entityFormActions}><button type="button" onClick={() => setEditor(null)}>取消</button><button className={styles.primaryButton} disabled={isBusy("objective:save")}>{isBusy("objective:save") ? <LoaderCircle className={styles.spin} size={16} /> : null}保存修改</button></div></form>
      </OkrEntityDialog>

      <OkrEntityDialog open={editor?.kind === "kr"} title={krRecord ? "编辑 Key Result" : "添加 Key Result"} description="数值型自动计算进度，定性结果可使用手动百分比。" onClose={() => setEditor(null)}>
        <form className={styles.entityForm} onSubmit={saveKeyResult}><label><span>中文标题</span><input name="titleZh" required defaultValue={krRecord?.titleZh ?? ""} /></label><label><span>英文标题（公开必填）</span><input name="titleEn" defaultValue={krRecord?.titleEn ?? ""} /></label><label className={styles.fullField}><span>中文说明</span><textarea name="descriptionZh" defaultValue={krRecord?.descriptionZh ?? ""} /></label><label className={styles.fullField}><span>英文说明（中文填写时公开必填）</span><textarea name="descriptionEn" defaultValue={krRecord?.descriptionEn ?? ""} /></label><label><span>进度方式</span><select name="progressMode" defaultValue={krRecord?.progressMode ?? "METRIC"}><option value="METRIC">数值</option><option value="MANUAL">手动百分比</option></select></label><label><span>状态</span><select name="status" defaultValue={krRecord?.status ?? "NOT_STARTED"}>{Object.entries(objectiveStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>起始值</span><input name="startValue" type="number" step="any" defaultValue={krRecord?.startValue ?? 0} /></label><label><span>当前值</span><input name="currentValue" type="number" step="any" defaultValue={krRecord?.currentValue ?? 0} /></label><label><span>目标值</span><input name="targetValue" type="number" step="any" defaultValue={krRecord?.targetValue ?? 100} /></label><label><span>手动进度（%）</span><input name="manualProgress" type="number" min="0" max="100" step="any" defaultValue={krRecord?.manualProgress ?? 0} /></label><label><span>单位</span><input name="unit" defaultValue={krRecord?.unit ?? ""} /></label><label><span>权重</span><input name="weight" type="number" min="0.1" step="0.1" defaultValue={krRecord?.weight ?? 1} /></label><label><span>排序</span><input name="sortOrder" type="number" min="0" defaultValue={krRecord?.sortOrder ?? objective.keyResults.length} /></label><div className={styles.entityFormActions}><button type="button" onClick={() => setEditor(null)}>取消</button><button className={styles.primaryButton} disabled={isBusy("kr:save")}>{isBusy("kr:save") ? <LoaderCircle className={styles.spin} size={16} /> : null}{krRecord ? "保存修改" : "创建 KR"}</button></div></form>
      </OkrEntityDialog>

      <ConfirmDialog open={Boolean(deletingKr)} title="确认删除关键结果" target={deletingKr?.titleZh ?? ""} description="该 KR 的行动项与全部进度历史会一并删除。" busy={deletingKr ? isBusy(`kr:delete:${deletingKr.id}`) : false} triggerRef={deleteTriggerRef} onConfirm={confirmDelete} onCancel={() => setDeletingKr(null)} />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
