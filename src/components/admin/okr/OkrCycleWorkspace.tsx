"use client";

import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

import styles from "../../../app/admin/admin.module.css";
import { ConfirmDialog } from "../ConfirmDialog";
import { EmptyState } from "../EmptyState";
import { FeedbackCenter } from "../FeedbackCenter";
import { PageHeader } from "../PageHeader";
import { adminRequest } from "../request";
import type { AiContentDraftData, ObjectiveData, OkrCycleData, ReviewData } from "../types";
import { useAdminAction } from "../useAdminAction";
import { dateValue, jsonRequest } from "../workspace-utils";
import { OkrEntityDialog } from "./OkrEntityDialog";
import { dateInput, formatDate, getCycleSummary, getObjectiveSummary, objectiveStatusLabels } from "./utils";

type EditorState =
  | { kind: "objective"; record?: ObjectiveData }
  | { kind: "review"; record?: ReviewData };

type DeleteState = { key: string; path: string; target: string; description: string };

export function OkrCycleWorkspace({
  initialCycle,
  initialAiDrafts,
}: {
  initialCycle: OkrCycleData;
  initialAiDrafts: AiContentDraftData[];
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [aiDrafts, setAiDrafts] = useState(initialAiDrafts);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const cycle = initialCycle;
  const summary = getCycleSummary(cycle);
  const needsCycleReview = cycle.status === "COMPLETED" && !cycle.reviews.some((review) => review.objectiveId === null);

  async function saveObjective(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editor?.kind !== "objective") return;
    const form = new FormData(event.currentTarget);
    const editing = Boolean(editor.record);
    const result = await runAction("okr:save-objective", async () => {
      await adminRequest(editing ? `/api/admin/okr/objectives/${editor.record!.id}` : "/api/admin/okr/objectives", jsonRequest(editing ? "PATCH" : "POST", {
        cycleId: cycle.id,
        titleZh: form.get("titleZh"),
        titleEn: form.get("titleEn") || null,
        descriptionZh: form.get("descriptionZh") || null,
        descriptionEn: form.get("descriptionEn") || null,
        status: form.get("status"),
        visibility: form.get("visibility"),
        sortOrder: Number(form.get("sortOrder") || 0),
        startDate: dateValue(form.get("startDate")),
        endDate: dateValue(form.get("endDate")),
      }));
      router.refresh();
      return true;
    }, editing ? "目标已更新" : "目标已创建");
    if (result) setEditor(null);
  }

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editor?.kind !== "review") return;
    const form = new FormData(event.currentTarget);
    const editing = Boolean(editor.record);
    const result = await runAction("okr:save-review", async () => {
      await adminRequest(editing ? `/api/admin/okr/reviews/${editor.record!.id}` : "/api/admin/okr/reviews", jsonRequest(editing ? "PATCH" : "POST", {
        cycleId: cycle.id,
        objectiveId: form.get("objectiveId") || null,
        achievementsZh: form.get("achievementsZh"),
        achievementsEn: form.get("achievementsEn") || null,
        problemsZh: form.get("problemsZh"),
        lessonsZh: form.get("lessonsZh"),
        nextActionsZh: form.get("nextActionsZh"),
        score: form.get("score") ? Number(form.get("score")) : null,
        visibility: form.get("visibility"),
        reviewedAt: new Date().toISOString(),
      }));
      router.refresh();
      return true;
    }, editing ? "复盘已更新" : "复盘已创建");
    if (result) setEditor(null);
  }

  function requestDelete(event: MouseEvent<HTMLButtonElement>, state: DeleteState) {
    deleteTriggerRef.current = event.currentTarget;
    setDeleteState(state);
  }

  async function confirmDelete() {
    if (!deleteState) return;
    const result = await runAction(deleteState.key, async () => {
      await adminRequest(deleteState.path, { method: "DELETE" });
      router.refresh();
      return true;
    }, "记录已删除");
    if (result) setDeleteState(null);
  }

  async function generateAiReview(objectiveId?: string) {
    const key = `okr:ai:${objectiveId ?? "cycle"}`;
    const draft = await runAction(key, () => adminRequest<AiContentDraftData>(
      "/api/admin/ai/drafts",
      jsonRequest("POST", { useCase: "OKR_REVIEW", targetId: cycle.id, objectiveId: objectiveId ?? null }),
    ), "AI 复盘草稿已生成");
    if (!draft) return;
    setAiDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)]);
  }

  async function applyAiReview(draft: AiContentDraftData) {
    const applied = await runAction(`okr:ai:apply:${draft.id}`, () => adminRequest<AiContentDraftData>(
      `/api/admin/ai/drafts/${draft.id}/apply`, { method: "POST" },
    ), "AI 草稿已应用为私密复盘");
    if (!applied) return;
    setAiDrafts((current) => current.filter((item) => item.id !== draft.id));
    router.refresh();
  }

  async function discardAiReview(draft: AiContentDraftData) {
    const discarded = await runAction(`okr:ai:discard:${draft.id}`, () => adminRequest<AiContentDraftData>(
      `/api/admin/ai/drafts/${draft.id}`, { method: "DELETE" },
    ), "AI 复盘草稿已丢弃");
    if (discarded) setAiDrafts((current) => current.filter((item) => item.id !== draft.id));
  }

  const objectiveRecord = editor?.kind === "objective" ? editor.record : undefined;
  const reviewRecord = editor?.kind === "review" ? editor.record : undefined;

  return (
    <section>
      <Link className={styles.backLink} href="/admin/okr"><ArrowLeft size={16} />返回周期列表</Link>
      <PageHeader title={cycle.nameZh} description={`${formatDate(cycle.startDate)} - ${formatDate(cycle.endDate)} · ${cycle.visibility === "PUBLIC" ? "公开" : "私密"}`} action={<button type="button" className={styles.primaryButton} onClick={() => setEditor({ kind: "objective" })}><Plus size={18} />新建目标</button>} />

      <div className={styles.metrics}>
        <article><span>周期进度</span><strong>{summary.progress}%</strong></article>
        <article><span>Objectives</span><strong>{summary.counts.objectives}</strong></article>
        <article><span>关键结果</span><strong>{summary.counts.keyResults}</strong></article>
        <article><span>风险 KR</span><strong>{summary.counts.atRisk}</strong></article>
      </div>

      {needsCycleReview ? (
        <section className={styles.reviewPrompt}>
          <div><span className={styles.kicker}>CYCLE COMPLETED</span><h2>这个周期还缺少完整复盘</h2><p>总结成果、问题和下一步，把完成状态转化为可复用经验。</p></div>
          <button type="button" className={styles.primaryButton} onClick={() => setEditor({ kind: "review" })}>创建周期复盘</button>
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>OBJECTIVES</span><h2>目标与执行状态</h2></div><span>{cycle.objectives.length} 个目标</span></div>
        {cycle.objectives.length ? <div className={styles.objectiveList}>{cycle.objectives.map((objective) => {
          const objectiveSummary = getObjectiveSummary(objective, cycle.endDate);
          return (
            <article className={styles.objectiveRow} key={objective.id}>
              <div className={styles.objectiveCopy}><span className={styles.statusBadge}>{objectiveStatusLabels[objective.status] ?? objective.status}</span><h3>{objective.titleZh}</h3><p>{objective.descriptionZh || "尚未补充目标说明"}</p><small>{objective.keyResults.length} 个 KR · {objectiveSummary.counts.atRisk} 个风险项</small></div>
              <div className={styles.objectiveProgress}><strong>{objectiveSummary.progress}%</strong><div><i style={{ width: `${objectiveSummary.progress}%` }} /></div></div>
              <div className={styles.rowActions}>
                <Link className={styles.primaryButton} href={`/admin/okr/cycles/${cycle.id}/objectives/${objective.id}`}>进入目标</Link>
                <button type="button" onClick={() => generateAiReview(objective.id)} disabled={isBusy(`okr:ai:${objective.id}`)}>{isBusy(`okr:ai:${objective.id}`) ? <LoaderCircle className={styles.spin} size={15} /> : <Sparkles size={15} />}AI 生成复盘</button>
                <button type="button" className={styles.iconButton} title="编辑目标" aria-label={`编辑目标 ${objective.titleZh}`} onClick={() => setEditor({ kind: "objective", record: objective })}><Pencil size={16} /></button>
                <button type="button" className={styles.iconButton} title="删除目标" aria-label={`删除目标 ${objective.titleZh}`} onClick={(event) => requestDelete(event, { key: `delete-objective:${objective.id}`, path: `/api/admin/okr/objectives/${objective.id}`, target: objective.titleZh, description: "该目标中的 KR、行动项和进度历史会一并删除。" })}><Trash2 size={16} /></button>
              </div>
            </article>
          );
        })}</div> : <EmptyState title="这个周期还没有目标" description="先创建 Objective，再进入详情拆分关键结果与行动项。" action={<button type="button" className={styles.secondaryButton} onClick={() => setEditor({ kind: "objective" })}>新建目标</button>} />}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>REVIEWS</span><h2>周期与目标复盘</h2></div><div className={styles.rowActions}><button type="button" onClick={() => generateAiReview()} disabled={isBusy("okr:ai:cycle")}>{isBusy("okr:ai:cycle") ? <LoaderCircle className={styles.spin} size={16} /> : <Sparkles size={16} />}AI 生成复盘</button><button type="button" onClick={() => setEditor({ kind: "review" })}><Plus size={16} />添加复盘</button></div></div>
        {aiDrafts.length ? <div className={styles.aiDraftList}>{aiDrafts.map((draft) => {
          const sourceObjectives = Array.isArray(draft.sourceSnapshot.objectives) ? draft.sourceSnapshot.objectives : [];
          const sourceObjective = sourceObjectives[0] && typeof sourceObjectives[0] === "object" ? sourceObjectives[0] as Record<string, unknown> : null;
          const fields = [["成果", "achievementsZh"], ["问题", "problemsZh"], ["经验", "lessonsZh"], ["下一步", "nextActionsZh"]] as const;
          return <article className={styles.aiDraftCard} key={draft.id}>
            <div className={styles.aiDraftHeader}>
              <div><span className={styles.statusBadge}>私密草稿</span><h3>{sourceObjective ? `${String(sourceObjective.titleZh ?? "目标")} · 目标复盘` : `${cycle.nameZh} · 周期复盘`}</h3><small>{draft.model}</small></div>
              <div className={styles.rowActions}><button type="button" className={styles.primaryButton} onClick={() => applyAiReview(draft)} disabled={isBusy(`okr:ai:apply:${draft.id}`)}><Check size={15} />应用为私密复盘</button><button type="button" onClick={() => discardAiReview(draft)} disabled={isBusy(`okr:ai:discard:${draft.id}`)}><Trash2 size={15} />丢弃草稿</button></div>
            </div>
            <div className={styles.aiCompareGrid}>
              <div className={styles.aiCompareColumn}><strong>来源内容</strong><div><span>范围</span><p>{sourceObjective ? String(sourceObjective.titleZh ?? "目标") : cycle.nameZh}</p></div><div><span>事实记录</span><p>{sourceObjectives.length} 个目标 · {sourceObjectives.reduce((count, item) => count + (item && typeof item === "object" && Array.isArray(Reflect.get(item, "keyResults")) ? Reflect.get(item, "keyResults").length : 0), 0)} 个 KR</p></div></div>
              <div className={styles.aiCompareColumn}><strong>生成草稿</strong>{fields.map(([label, key]) => <div key={key}><span>{label}</span><p>{String(draft.content[key] ?? "未生成")}</p></div>)}</div>
            </div>
          </article>;
        })}</div> : null}
        {cycle.reviews.length ? <div className={styles.reviewList}>{cycle.reviews.map((review) => (
          <div className={styles.listRow} key={review.id}>
            <span><strong>{review.objectiveId ? "目标复盘" : "周期复盘"} · {review.achievementsZh}</strong><small>{review.visibility} · 评分 {review.score ?? "-"}</small></span>
            <time>{formatDate(review.reviewedAt)}</time>
            <div className={styles.rowActions}><button type="button" className={styles.iconButton} title="编辑复盘" aria-label="编辑复盘" onClick={() => setEditor({ kind: "review", record: review })}><Pencil size={16} /></button><button type="button" className={styles.iconButton} title="删除复盘" aria-label="删除复盘" onClick={(event) => requestDelete(event, { key: `delete-review:${review.id}`, path: `/api/admin/okr/reviews/${review.id}`, target: review.achievementsZh, description: "复盘会永久删除，但不会改变 OKR 进度。" })}><Trash2 size={16} /></button></div>
          </div>
        ))}</div> : <EmptyState title="还没有复盘" description="周期推进中可以持续记录阶段经验，完成后补充周期复盘。" action={<button type="button" onClick={() => setEditor({ kind: "review" })}>添加复盘</button>} />}
      </section>

      <OkrEntityDialog open={editor?.kind === "objective"} title={objectiveRecord ? "编辑 Objective" : "新建 Objective"} description="目标负责表达方向，关键结果在目标详情中拆解。" onClose={() => setEditor(null)}>
        <form className={styles.entityForm} onSubmit={saveObjective}>
          <label><span>中文标题</span><input name="titleZh" required defaultValue={objectiveRecord?.titleZh ?? ""} /></label><label><span>英文标题</span><input name="titleEn" defaultValue={objectiveRecord?.titleEn ?? ""} /></label>
          <label className={styles.fullField}><span>中文说明</span><textarea name="descriptionZh" defaultValue={objectiveRecord?.descriptionZh ?? ""} /></label><label className={styles.fullField}><span>英文说明</span><textarea name="descriptionEn" defaultValue={objectiveRecord?.descriptionEn ?? ""} /></label>
          <label><span>状态</span><select name="status" defaultValue={objectiveRecord?.status ?? "NOT_STARTED"}>{Object.entries(objectiveStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>可见性</span><select name="visibility" defaultValue={objectiveRecord?.visibility ?? "PRIVATE"}><option value="PRIVATE">私密</option><option value="PUBLIC">公开</option></select></label>
          <label><span>开始日期</span><input type="date" name="startDate" defaultValue={dateInput(objectiveRecord?.startDate)} /></label><label><span>结束日期</span><input type="date" name="endDate" defaultValue={dateInput(objectiveRecord?.endDate)} /></label>
          <label><span>排序</span><input type="number" min="0" name="sortOrder" defaultValue={objectiveRecord?.sortOrder ?? cycle.objectives.length} /></label>
          <div className={styles.entityFormActions}><button type="button" onClick={() => setEditor(null)}>取消</button><button className={styles.primaryButton} disabled={isBusy("okr:save-objective")}>{isBusy("okr:save-objective") ? <LoaderCircle className={styles.spin} size={16} /> : null}{objectiveRecord ? "保存修改" : "创建目标"}</button></div>
        </form>
      </OkrEntityDialog>

      <OkrEntityDialog open={editor?.kind === "review"} title={reviewRecord ? "编辑复盘" : "添加复盘"} description="记录事实、判断和后续行动，不自动改变目标进度。" onClose={() => setEditor(null)}>
        <form className={styles.entityForm} onSubmit={saveReview}>
          <label><span>关联范围</span><select name="objectiveId" defaultValue={reviewRecord?.objectiveId ?? ""}><option value="">周期复盘</option>{cycle.objectives.map((objective) => <option value={objective.id} key={objective.id}>{objective.titleZh}</option>)}</select></label>
          <label><span>评分（0-10）</span><input name="score" type="number" min="0" max="10" step="0.1" defaultValue={reviewRecord?.score ?? ""} /></label>
          <label className={styles.fullField}><span>成果</span><textarea name="achievementsZh" required defaultValue={reviewRecord?.achievementsZh ?? ""} /></label>
          <label className={styles.fullField}><span>问题</span><textarea name="problemsZh" required defaultValue={reviewRecord?.problemsZh ?? ""} /></label>
          <label className={styles.fullField}><span>经验</span><textarea name="lessonsZh" required defaultValue={reviewRecord?.lessonsZh ?? ""} /></label>
          <label className={styles.fullField}><span>下一步</span><textarea name="nextActionsZh" required defaultValue={reviewRecord?.nextActionsZh ?? ""} /></label>
          <label><span>可见性</span><select name="visibility" defaultValue={reviewRecord?.visibility ?? "PRIVATE"}><option value="PRIVATE">私密</option><option value="PUBLIC">公开</option></select></label>
          <input type="hidden" name="achievementsEn" value={reviewRecord?.achievementsEn ?? ""} />
          <div className={styles.entityFormActions}><button type="button" onClick={() => setEditor(null)}>取消</button><button className={styles.primaryButton} disabled={isBusy("okr:save-review")}>{isBusy("okr:save-review") ? <LoaderCircle className={styles.spin} size={16} /> : null}{reviewRecord ? "保存修改" : "创建复盘"}</button></div>
        </form>
      </OkrEntityDialog>

      <ConfirmDialog open={Boolean(deleteState)} title="确认删除记录" target={deleteState?.target ?? ""} description={deleteState?.description ?? ""} busy={deleteState ? isBusy(deleteState.key) : false} triggerRef={deleteTriggerRef} onConfirm={confirmDelete} onCancel={() => setDeleteState(null)} />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
