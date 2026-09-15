"use client";

import { LoaderCircle, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent, type MouseEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { adminRequest } from "./request";
import type { KeyResultData, OkrCycleData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { dateValue, editableRecord, jsonRequest } from "./workspace-utils";

interface DeleteRequest {
  key: string;
  path: string;
  target: string;
  impact: string;
}

function VisibilitySelect({ disabled = false }: { disabled?: boolean }) {
  return (
    <label>
      <span>可见性</span>
      <select name="visibility" disabled={disabled}>
        <option value="PRIVATE">私密</option>
        <option value="PUBLIC">公开</option>
      </select>
    </label>
  );
}

function BusyIcon({ busy, size = 16 }: { busy: boolean; size?: number }) {
  return busy ? <LoaderCircle className={styles.spin} size={size} /> : null;
}

export function OkrWorkspace({ initialCycles }: { initialCycles: OkrCycleData[] }) {
  const [cycles, setCycles] = useState(initialCycles);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const cycleNameRef = useRef<HTMLInputElement>(null);
  const deleteTriggerRef = useRef<HTMLElement | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();

  async function fetchOkrData() {
    setCycles(await adminRequest<OkrCycleData[]>("/api/admin/okr"));
  }

  async function refreshOkr() {
    await runAction("okr:refresh", fetchOkrData, "OKR 数据已更新");
  }

  async function createCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const result = await runAction("okr:create-cycle", async () => {
      await adminRequest("/api/admin/okr/cycles", jsonRequest("POST", {
        nameZh: form.get("nameZh"),
        nameEn: form.get("nameEn") || null,
        type: form.get("type"),
        startDate: dateValue(form.get("startDate")),
        endDate: dateValue(form.get("endDate")),
        status: "ACTIVE",
        visibility: form.get("visibility"),
      }));
      await fetchOkrData();
      return true;
    }, "周期已创建");
    if (result) formElement.reset();
  }

  async function createObjective(event: FormEvent<HTMLFormElement>, cycleId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const key = `okr:create-objective:${cycleId}`;
    const result = await runAction(key, async () => {
      await adminRequest("/api/admin/okr/objectives", jsonRequest("POST", {
        cycleId,
        titleZh: form.get("titleZh"),
        titleEn: form.get("titleEn") || null,
        visibility: form.get("visibility"),
        status: "NOT_STARTED",
        sortOrder: 0,
      }));
      await fetchOkrData();
      return true;
    }, "目标已创建");
    if (result) formElement.reset();
  }

  async function createKeyResult(event: FormEvent<HTMLFormElement>, objectiveId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const mode = String(form.get("progressMode"));
    const key = `okr:create-kr:${objectiveId}`;
    const result = await runAction(key, async () => {
      await adminRequest("/api/admin/okr/key-results", jsonRequest("POST", {
        objectiveId,
        titleZh: form.get("titleZh"),
        progressMode: mode,
        startValue: mode === "METRIC" ? Number(form.get("startValue")) : null,
        currentValue: mode === "METRIC" ? Number(form.get("startValue")) : null,
        targetValue: mode === "METRIC" ? Number(form.get("targetValue")) : null,
        manualProgress: mode === "MANUAL" ? Number(form.get("manualProgress")) : null,
        weight: Number(form.get("weight") || 1),
        status: "NOT_STARTED",
        sortOrder: 0,
      }));
      await fetchOkrData();
      return true;
    }, "关键结果已创建");
    if (result) formElement.reset();
  }

  async function updateProgress(event: FormEvent<HTMLFormElement>, keyResult: KeyResultData) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const key = `okr:progress:${keyResult.id}`;
    const result = await runAction(key, async () => {
      const progress = Number(form.get("progress"));
      await adminRequest(
        `/api/admin/okr/key-results/${keyResult.id}/progress`,
        jsonRequest("POST", keyResult.progressMode === "MANUAL"
          ? { manualProgress: progress, noteZh: form.get("noteZh") }
          : { currentValue: progress, noteZh: form.get("noteZh") }),
      );
      await fetchOkrData();
      return true;
    }, "进度已记录");
    if (result) formElement.reset();
  }

  async function createReview(event: FormEvent<HTMLFormElement>, cycleId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const key = `okr:create-review:${cycleId}`;
    const result = await runAction(key, async () => {
      await adminRequest("/api/admin/okr/reviews", jsonRequest("POST", {
        cycleId,
        objectiveId: form.get("objectiveId") || null,
        achievementsZh: form.get("achievementsZh"),
        problemsZh: form.get("problemsZh"),
        lessonsZh: form.get("lessonsZh"),
        nextActionsZh: form.get("nextActionsZh"),
        score: form.get("score") ? Number(form.get("score")) : null,
        visibility: form.get("visibility"),
        reviewedAt: new Date().toISOString(),
      }));
      await fetchOkrData();
      return true;
    }, "复盘已创建");
    if (result) formElement.reset();
  }

  async function updateStatus(path: string, value: string, key: string, message: string) {
    await runAction(key, async () => {
      await adminRequest(path, jsonRequest("PATCH", { status: value }));
      await fetchOkrData();
    }, message);
  }

  async function editRecord(path: string, record: object, key: string) {
    const value = window.prompt("编辑字段 JSON", JSON.stringify(editableRecord(record), null, 2));
    if (value == null) return;
    await runAction(key, async () => {
      await adminRequest(path, jsonRequest("PATCH", JSON.parse(value) as unknown));
      await fetchOkrData();
    }, "记录已更新");
  }

  function requestDelete(event: MouseEvent<HTMLButtonElement>, request: DeleteRequest) {
    deleteTriggerRef.current = event.currentTarget;
    setDeleteRequest(request);
  }

  async function confirmDelete() {
    if (!deleteRequest) return;
    const result = await runAction(deleteRequest.key, async () => {
      await adminRequest(deleteRequest.path, { method: "DELETE" });
      await fetchOkrData();
      return true;
    }, "记录已删除");
    if (result) setDeleteRequest(null);
  }

  const refreshBusy = isBusy("okr:refresh");
  const createCycleBusy = isBusy("okr:create-cycle");

  return (
    <section>
      <PageHeader
        title="OKR 管理"
        description="管理周期、目标、关键结果、进度更新与复盘。"
        action={(
          <button type="button" className={styles.iconTextButton} onClick={refreshOkr} disabled={refreshBusy}>
            {refreshBusy ? <LoaderCircle className={styles.spin} size={18} /> : <RefreshCw size={18} />}
            {refreshBusy ? "刷新中" : "刷新"}
          </button>
        )}
      />

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>NEW CYCLE</span><h2>新建周期</h2></div></div>
        <form className={`${styles.formGrid} ${styles.cycleForm}`} onSubmit={createCycle}>
          <label><span>周期名称</span><input ref={cycleNameRef} name="nameZh" placeholder="例如：2026 Q4" required disabled={createCycleBusy} /></label>
          <label><span>英文名称</span><input name="nameEn" placeholder="例如：2026 Q4" disabled={createCycleBusy} /></label>
          <label><span>周期类型</span><select name="type" disabled={createCycleBusy}><option value="QUARTER">季度</option><option value="YEAR">年度</option><option value="CUSTOM">自定义</option></select></label>
          <label><span>开始日期</span><input name="startDate" type="date" required disabled={createCycleBusy} /></label>
          <label><span>结束日期</span><input name="endDate" type="date" required disabled={createCycleBusy} /></label>
          <VisibilitySelect disabled={createCycleBusy} />
          <button className={styles.primaryButton} disabled={createCycleBusy}><BusyIcon busy={createCycleBusy} />{createCycleBusy ? "创建中" : "创建周期"}</button>
        </form>
      </section>

      {cycles.length ? cycles.map((cycle) => {
        const cycleStatusKey = `okr:cycle-status:${cycle.id}`;
        const cycleEditKey = `okr:edit-cycle:${cycle.id}`;
        const objectiveCreateKey = `okr:create-objective:${cycle.id}`;
        return (
          <article className={`${styles.panel} ${styles.cyclePanel}`} key={cycle.id}>
            <div className={styles.entityHead}>
              <div>
                <span className={styles.kicker}>{cycle.type} · {cycle.visibility}</span>
                <h2>{cycle.nameZh}</h2>
                <small>{new Date(cycle.startDate).toLocaleDateString("zh-CN")} - {new Date(cycle.endDate).toLocaleDateString("zh-CN")}</small>
              </div>
              <div className={styles.actions}>
                <label className={styles.compactField}><span className={styles.srOnly}>周期状态</span><select value={cycle.status} disabled={isBusy(cycleStatusKey)} onChange={(event) => updateStatus(`/api/admin/okr/cycles/${cycle.id}`, event.currentTarget.value, cycleStatusKey, "周期状态已更新")}><option value="DRAFT">草稿</option><option value="ACTIVE">进行中</option><option value="COMPLETED">已完成</option><option value="ARCHIVED">归档</option></select></label>
                <button type="button" className={styles.iconButton} title="编辑周期" aria-label={`编辑周期 ${cycle.nameZh}`} onClick={() => editRecord(`/api/admin/okr/cycles/${cycle.id}`, cycle, cycleEditKey)} disabled={isBusy(cycleEditKey)}><BusyIcon busy={isBusy(cycleEditKey)} /><Pencil size={17} /></button>
                <button type="button" className={styles.iconButton} title="删除周期" aria-label={`删除周期 ${cycle.nameZh}`} onClick={(event) => requestDelete(event, { key: `okr:delete-cycle:${cycle.id}`, path: `/api/admin/okr/cycles/${cycle.id}`, target: cycle.nameZh, impact: "该周期中的目标、关键结果、进度记录与复盘将一并删除。" })}><Trash2 size={17} /></button>
              </div>
            </div>

            <form id={`objective-form-${cycle.id}`} className={`${styles.formGrid} ${styles.objectiveForm}`} onSubmit={(event) => createObjective(event, cycle.id)}>
              <label><span>新目标标题</span><input name="titleZh" placeholder="输入 Objective" required disabled={isBusy(objectiveCreateKey)} /></label>
              <label><span>英文标题</span><input name="titleEn" placeholder="Objective title" disabled={isBusy(objectiveCreateKey)} /></label>
              <VisibilitySelect disabled={isBusy(objectiveCreateKey)} />
              <button disabled={isBusy(objectiveCreateKey)}><BusyIcon busy={isBusy(objectiveCreateKey)} />{isBusy(objectiveCreateKey) ? "添加中" : "添加目标"}</button>
            </form>

            {cycle.objectives.length ? cycle.objectives.map((objective) => {
              const objectiveStatusKey = `okr:objective-status:${objective.id}`;
              const objectiveEditKey = `okr:edit-objective:${objective.id}`;
              const keyResultCreateKey = `okr:create-kr:${objective.id}`;
              return (
                <section className={styles.objective} key={objective.id}>
                  <div className={styles.entityHead}>
                    <div><h3>{objective.titleZh}</h3><small>{objective.visibility} · {objective.keyResults.length} 个关键结果</small></div>
                    <div className={styles.actions}>
                      <label className={styles.compactField}><span className={styles.srOnly}>目标状态</span><select value={objective.status} disabled={isBusy(objectiveStatusKey)} onChange={(event) => updateStatus(`/api/admin/okr/objectives/${objective.id}`, event.currentTarget.value, objectiveStatusKey, "目标状态已更新")}><option value="NOT_STARTED">未开始</option><option value="IN_PROGRESS">进行中</option><option value="AT_RISK">有风险</option><option value="COMPLETED">已完成</option><option value="CANCELLED">取消</option></select></label>
                      <button type="button" className={styles.iconButton} title="编辑目标" aria-label={`编辑目标 ${objective.titleZh}`} onClick={() => editRecord(`/api/admin/okr/objectives/${objective.id}`, objective, objectiveEditKey)} disabled={isBusy(objectiveEditKey)}><BusyIcon busy={isBusy(objectiveEditKey)} /><Pencil size={16} /></button>
                      <button type="button" className={styles.iconButton} title="删除目标" aria-label={`删除目标 ${objective.titleZh}`} onClick={(event) => requestDelete(event, { key: `okr:delete-objective:${objective.id}`, path: `/api/admin/okr/objectives/${objective.id}`, target: objective.titleZh, impact: "该目标中的关键结果及全部进度记录将一并删除，关联复盘会解除目标关联。" })}><Trash2 size={16} /></button>
                    </div>
                  </div>

                  <form id={`kr-form-${objective.id}`} className={`${styles.formGrid} ${styles.krCreateForm}`} onSubmit={(event) => createKeyResult(event, objective.id)}>
                    <label><span>关键结果</span><input name="titleZh" placeholder="输入 Key Result" required disabled={isBusy(keyResultCreateKey)} /></label>
                    <label><span>进度方式</span><select name="progressMode" disabled={isBusy(keyResultCreateKey)}><option value="METRIC">数值</option><option value="MANUAL">手动</option></select></label>
                    <label><span>起始值</span><input name="startValue" type="number" placeholder="0" defaultValue="0" disabled={isBusy(keyResultCreateKey)} /></label>
                    <label><span>目标值</span><input name="targetValue" type="number" placeholder="100" defaultValue="100" disabled={isBusy(keyResultCreateKey)} /></label>
                    <label><span>手动 %</span><input name="manualProgress" type="number" placeholder="0" defaultValue="0" disabled={isBusy(keyResultCreateKey)} /></label>
                    <label><span>权重</span><input name="weight" type="number" min="0.1" step="0.1" defaultValue="1" disabled={isBusy(keyResultCreateKey)} /></label>
                    <button disabled={isBusy(keyResultCreateKey)}><BusyIcon busy={isBusy(keyResultCreateKey)} />{isBusy(keyResultCreateKey) ? "添加中" : "添加 KR"}</button>
                  </form>

                  {objective.keyResults.length ? objective.keyResults.map((keyResult) => {
                    const progressKey = `okr:progress:${keyResult.id}`;
                    const editKey = `okr:edit-kr:${keyResult.id}`;
                    return (
                      <div className={styles.kr} key={keyResult.id}>
                        <div className={styles.krSummary}>
                          <strong>{keyResult.titleZh}</strong>
                          <small>{keyResult.progressMode === "MANUAL" ? `${keyResult.manualProgress ?? 0}%` : `${keyResult.currentValue ?? 0} / ${keyResult.targetValue ?? 0}`} · 权重 {keyResult.weight}</small>
                        </div>
                        <form className={styles.progressForm} onSubmit={(event) => updateProgress(event, keyResult)}>
                          <label><span className={styles.srOnly}>更新进度</span><input name="progress" type="number" step="any" placeholder={keyResult.progressMode === "MANUAL" ? "进度 %" : "当前值"} required disabled={isBusy(progressKey)} /></label>
                          <label><span className={styles.srOnly}>更新说明</span><input name="noteZh" placeholder="更新说明" disabled={isBusy(progressKey)} /></label>
                          <button disabled={isBusy(progressKey)}><BusyIcon busy={isBusy(progressKey)} />{isBusy(progressKey) ? "记录中" : "记录"}</button>
                        </form>
                        <div className={styles.rowActions}>
                          <button type="button" className={styles.iconButton} title="编辑 KR" aria-label={`编辑 KR ${keyResult.titleZh}`} onClick={() => editRecord(`/api/admin/okr/key-results/${keyResult.id}`, keyResult, editKey)} disabled={isBusy(editKey)}><BusyIcon busy={isBusy(editKey)} /><Pencil size={15} /></button>
                          <button type="button" className={styles.iconButton} title="删除 KR" aria-label={`删除 KR ${keyResult.titleZh}`} onClick={(event) => requestDelete(event, { key: `okr:delete-kr:${keyResult.id}`, path: `/api/admin/okr/key-results/${keyResult.id}`, target: keyResult.titleZh, impact: "该关键结果的全部进度更新记录将一并删除。" })}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    );
                  }) : (
                    <EmptyState title="还没有关键结果" description="为这个目标添加可衡量的结果。" action={<a className={styles.secondaryButton} href={`#kr-form-${objective.id}`}>添加关键结果</a>} />
                  )}
                </section>
              );
            }) : (
              <EmptyState title="这个周期还没有目标" description="先建立一个明确的 Objective，再拆分关键结果。" action={<a className={styles.secondaryButton} href={`#objective-form-${cycle.id}`}>添加目标</a>} />
            )}

            <details className={styles.reviewComposer}>
              <summary>添加复盘</summary>
              <form className={styles.reviewForm} onSubmit={(event) => createReview(event, cycle.id)}>
                <label><span>关联范围</span><select name="objectiveId"><option value="">周期复盘</option>{cycle.objectives.map((objective) => <option value={objective.id} key={objective.id}>{objective.titleZh}</option>)}</select></label>
                <label><span>成果</span><textarea name="achievementsZh" required /></label>
                <label><span>问题</span><textarea name="problemsZh" required /></label>
                <label><span>经验</span><textarea name="lessonsZh" required /></label>
                <label><span>下一步</span><textarea name="nextActionsZh" required /></label>
                <label><span>评分（0-10）</span><input name="score" type="number" min="0" max="10" step="0.1" /></label>
                <VisibilitySelect />
                <button className={styles.primaryButton} disabled={isBusy(`okr:create-review:${cycle.id}`)}><BusyIcon busy={isBusy(`okr:create-review:${cycle.id}`)} />{isBusy(`okr:create-review:${cycle.id}`) ? "保存中" : "保存复盘"}</button>
              </form>
            </details>

            {cycle.reviews.length ? <div className={styles.reviewList}>{cycle.reviews.map((review) => {
              const editKey = `okr:edit-review:${review.id}`;
              return (
                <div className={styles.listRow} key={review.id}>
                  <span><strong>{review.achievementsZh}</strong><small>{review.visibility} · {review.score ?? "未评分"}</small></span>
                  <time>{new Date(review.reviewedAt).toLocaleDateString("zh-CN")}</time>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.iconButton} title="编辑复盘" aria-label="编辑复盘" onClick={() => editRecord(`/api/admin/okr/reviews/${review.id}`, review, editKey)} disabled={isBusy(editKey)}><BusyIcon busy={isBusy(editKey)} /><Pencil size={16} /></button>
                    <button type="button" className={styles.iconButton} title="删除复盘" aria-label="删除复盘" onClick={(event) => requestDelete(event, { key: `okr:delete-review:${review.id}`, path: `/api/admin/okr/reviews/${review.id}`, target: review.achievementsZh, impact: "该复盘记录将永久删除，不会改变目标或关键结果进度。" })}><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}</div> : null}
          </article>
        );
      }) : (
        <section className={styles.panel}>
          <EmptyState title="还没有 OKR 周期" description="创建第一个周期，开始组织目标与关键结果。" action={<button type="button" className={styles.secondaryButton} onClick={() => cycleNameRef.current?.focus()}>创建周期</button>} />
        </section>
      )}

      <ConfirmDialog
        open={Boolean(deleteRequest)}
        title="确认删除记录"
        target={deleteRequest?.target ?? ""}
        description={deleteRequest?.impact ?? ""}
        busy={deleteRequest ? isBusy(deleteRequest.key) : false}
        triggerRef={deleteTriggerRef}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteRequest(null)}
      />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
