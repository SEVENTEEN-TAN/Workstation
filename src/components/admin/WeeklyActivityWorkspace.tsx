"use client";

import { CalendarRange, Check, FilePenLine, LoaderCircle, RefreshCw, Save, Send, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import type {
  WeeklyActivityDraftData,
  WeeklyAiRewriteCandidate,
  WeeklyDraftCopy,
  WeeklyGenerationResult,
} from "../../lib/services/weekly-activity-drafts";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { adminRequest } from "./request";
import { useAdminAction } from "./useAdminAction";
import {
  copyFromWeeklyDraft,
  parseWeeklyDraftRecovery,
  sameWeeklyDraftCopy,
  weeklyDraftRecoveryKey,
} from "./weekly-editor-state";
import { jsonRequest } from "./workspace-utils";

type EditingState = {
  draft: WeeklyActivityDraftData;
  values: WeeklyDraftCopy;
  candidate: WeeklyAiRewriteCandidate | null;
  recovered: boolean;
};

const copyFields = [
  ["中文标题", "titleZh"],
  ["英文标题", "titleEn"],
  ["中文摘要", "summaryZh"],
  ["英文摘要", "summaryEn"],
] as const;

function dateOnly(value: string | Date) {
  const date = new Date(value);
  const local = new Date(date.getTime() + 8 * 60 * 60_000);
  return local.toISOString().slice(0, 10);
}

function currentWeek() {
  const now = new Date();
  const local = new Date(now.getTime() + 8 * 60 * 60_000);
  const day = local.getUTCDay() || 7;
  const monday = new Date(local);
  monday.setUTCDate(local.getUTCDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

function sourceCounts(draft: WeeklyActivityDraftData) {
  const source = draft.sourceSnapshot;
  return [
    ["GitHub", source.github.length], ["OKR", source.progress.length + source.actions.length],
    ["项目", source.projects.length], ["文章", source.articles.length], ["手工动态", source.activities.length],
  ] as const;
}

function sortDrafts(drafts: WeeklyActivityDraftData[]) {
  return [...drafts].sort((left, right) => new Date(right.weekStart).getTime() - new Date(left.weekStart).getTime());
}

function readRecovery(id: string) {
  if (typeof window === "undefined") return null;
  try {
    return parseWeeklyDraftRecovery(sessionStorage.getItem(weeklyDraftRecoveryKey(id)));
  } catch {
    return null;
  }
}

function writeRecovery(id: string, values: WeeklyDraftCopy) {
  try {
    sessionStorage.setItem(weeklyDraftRecoveryKey(id), JSON.stringify(values));
  } catch {
    // The form stays in memory when browser storage is unavailable.
  }
}

function clearRecovery(id: string) {
  try {
    sessionStorage.removeItem(weeklyDraftRecoveryKey(id));
  } catch {
    // Storage can be disabled; saving and editing must still work.
  }
}

function editorForDraft(draft: WeeklyActivityDraftData): EditingState {
  const recovered = readRecovery(draft.id);
  return { draft, values: recovered ?? copyFromWeeklyDraft(draft), candidate: null, recovered: Boolean(recovered) };
}

export function WeeklyActivityWorkspace({ initialDrafts }: { initialDrafts: WeeklyActivityDraftData[] }) {
  const week = currentWeek();
  const [drafts, setDrafts] = useState(() => sortDrafts(initialDrafts));
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [generationNotice, setGenerationNotice] = useState<string | null>(null);
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const generating = isBusy("weekly:generate");
  const saving = isBusy("weekly:save");
  const dirty = editing ? !sameWeeklyDraftCopy(editing.values, copyFromWeeklyDraft(editing.draft)) : false;
  const candidateStale = Boolean(editing?.candidate && !sameWeeklyDraftCopy(editing.values, editing.candidate.source));

  useEffect(() => {
    if (!editing) return;
    if (dirty) writeRecovery(editing.draft.id, editing.values);
    else clearRecovery(editing.draft.id);
  }, [dirty, editing]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const guardLinks = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!target || target.getAttribute("target") === "_blank") return;
      if (window.confirm("当前周报有未保存修改，离开后可在本浏览器恢复。仍要离开吗？")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("click", guardLinks, true);
    return () => document.removeEventListener("click", guardLinks, true);
  }, [dirty]);

  function openEditor(draft: WeeklyActivityDraftData) {
    if (editing?.draft.id === draft.id) return true;
    if (dirty && !window.confirm("当前周报有未保存修改，切换后会保留在本浏览器。仍要切换吗？")) return false;
    const next = editorForDraft(draft);
    setEditing(next);
    setEditorNotice(next.recovered ? "已恢复这个浏览器中尚未保存的修改。" : null);
    return true;
  }

  function closeEditor() {
    if (!editing) return;
    if (dirty && !window.confirm("确定放弃这次未保存的修改吗？")) return;
    clearRecovery(editing.draft.id);
    setEditing(null);
    setEditorNotice(null);
  }

  function updateValue(key: keyof WeeklyDraftCopy, value: string) {
    setEditing((current) => current ? { ...current, values: { ...current.values, [key]: value } } : current);
    setEditorNotice(null);
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirty && !window.confirm("当前修改会保留在本浏览器。仍要生成或打开其他周报吗？")) return;
    const data = new FormData(event.currentTarget);
    const result = await runAction("weekly:generate", () => adminRequest<WeeklyGenerationResult>(
      "/api/admin/weekly",
      jsonRequest("POST", { weekStart: data.get("weekStart"), weekEnd: data.get("weekEnd") }),
    ));
    if (!result) return;
    setDrafts((current) => sortDrafts([result.draft, ...current.filter((item) => item.id !== result.draft.id)]));
    const next = editorForDraft(result.draft);
    setEditing(result.draft.status === "DRAFT" ? next : null);
    setGenerationNotice(result.created ? "已生成新的私有周报草稿。" : "已打开这一周的现有草稿，人工修改没有被覆盖。");
    setEditorNotice(next.recovered ? "已恢复这个浏览器中尚未保存的修改。" : null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const saved = await runAction("weekly:save", () => adminRequest<WeeklyActivityDraftData>(
      `/api/admin/weekly/${editing.draft.id}`,
      jsonRequest("PATCH", { ...editing.values, expectedUpdatedAt: editing.draft.updatedAt }),
    ), "周报草稿已保存");
    if (!saved) return;
    clearRecovery(saved.id);
    setDrafts((current) => current.map((item) => item.id === saved.id ? saved : item));
    setEditing(null);
    setEditorNotice(null);
  }

  async function convert(draft: WeeklyActivityDraftData) {
    if (editing?.draft.id === draft.id && dirty) {
      window.alert("请先保存或明确放弃当前修改，再转换为职业动态。");
      return;
    }
    const converted = await runAction(`weekly:convert:${draft.id}`, () => adminRequest<WeeklyActivityDraftData>(
      `/api/admin/weekly/${draft.id}/convert`, { method: "POST" },
    ), "已转为私有职业动态");
    if (!converted) return;
    clearRecovery(converted.id);
    setDrafts((current) => current.map((item) => item.id === converted.id ? converted : item));
    if (editing?.draft.id === converted.id) setEditing(null);
  }

  async function rewriteWithAi(draft: WeeklyActivityDraftData) {
    if (editing?.draft.id !== draft.id && !openEditor(draft)) return;
    const source = editing?.draft.id === draft.id ? editing.values : editorForDraft(draft).values;
    const candidate = await runAction(`weekly:ai:${draft.id}`, () => adminRequest<WeeklyAiRewriteCandidate>(
      `/api/admin/weekly/${draft.id}/ai`,
      jsonRequest("POST", { ...source, expectedUpdatedAt: draft.updatedAt }),
    ), "AI 候选已生成，请对照后决定是否采用");
    if (!candidate) return;
    setEditing((current) => current?.draft.id === draft.id ? { ...current, candidate } : current);
  }

  function adoptCandidate() {
    if (!editing?.candidate || candidateStale) return;
    setEditing({ ...editing, values: editing.candidate.candidate, candidate: null, recovered: false });
    setEditorNotice("AI 候选已放入编辑区，尚未保存。");
  }

  return (
    <section>
      <PageHeader title="每周动态" description="从现有工作证据生成私有周报草稿，确认后再转入职业动态。" />

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>WEEKLY DRAFT</span><h2>生成草稿</h2></div><CalendarRange size={18} /></div>
        <form className={styles.entityForm} onSubmit={generate}>
          <label><span>开始日期</span><input name="weekStart" type="date" required defaultValue={week.start} /></label>
          <label><span>结束日期</span><input name="weekEnd" type="date" required defaultValue={week.end} /></label>
          <div className={styles.entityFormActions}>
            <button className={styles.primaryButton} disabled={generating || saving}>{generating ? <LoaderCircle className={styles.spin} size={17} /> : <RefreshCw size={17} />}{generating ? "处理中" : "生成或打开周报"}</button>
          </div>
        </form>
        {generationNotice ? <p className={styles.weeklyEditorNotice} role="status">{generationNotice}</p> : null}
      </section>

      {editing ? (
        <section className={styles.panel} aria-labelledby="weekly-editor-title">
          <div className={styles.sectionHeading}><div><span className={styles.kicker}>EDIT</span><h2 id="weekly-editor-title">编辑周报草稿</h2></div><FilePenLine size={18} /></div>
          {editing.recovered || editorNotice ? <p className={styles.weeklyEditorNotice} role="status">{editorNotice ?? "已恢复尚未保存的修改。"}</p> : null}
          <form className={styles.entityForm} onSubmit={save}>
            <label><span>中文标题</span><input name="titleZh" required maxLength={120} value={editing.values.titleZh} onChange={(event) => updateValue("titleZh", event.currentTarget.value)} /></label>
            <label><span>英文标题</span><input name="titleEn" maxLength={120} value={editing.values.titleEn} onChange={(event) => updateValue("titleEn", event.currentTarget.value)} /></label>
            <label><span>中文摘要</span><textarea name="summaryZh" required maxLength={4000} value={editing.values.summaryZh} onChange={(event) => updateValue("summaryZh", event.currentTarget.value)} /></label>
            <label><span>英文摘要</span><textarea name="summaryEn" maxLength={4000} value={editing.values.summaryEn} onChange={(event) => updateValue("summaryEn", event.currentTarget.value)} /></label>
            <div className={styles.entityFormActions}>
              <button type="button" onClick={closeEditor} disabled={saving}>取消</button>
              <button type="button" onClick={() => rewriteWithAi(editing.draft)} disabled={saving || isBusy(`weekly:ai:${editing.draft.id}`)}>{isBusy(`weekly:ai:${editing.draft.id}`) ? <LoaderCircle className={styles.spin} size={17} /> : <Sparkles size={17} />}生成 AI 候选</button>
              <button className={styles.primaryButton} disabled={saving || !dirty}>{saving ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}{saving ? "保存中" : "保存草稿"}</button>
            </div>
          </form>

          {editing.candidate ? <article className={styles.aiDraftCard}>
            <div className={styles.aiDraftHeader}>
              <div><span className={styles.statusBadge}>尚未保存</span><h3>AI 润色候选</h3><small>候选不会自动覆盖当前草稿</small></div>
              <button type="button" className={styles.primaryButton} disabled={candidateStale} onClick={adoptCandidate}><Check size={15} />采用此候选</button>
            </div>
            {candidateStale ? <p className={styles.weeklyEditorNotice} role="alert">候选生成后当前内容又发生了变化。为避免覆盖，请重新生成候选。</p> : null}
            <div className={styles.aiCompareGrid}>
              <div className={styles.aiCompareColumn}><strong>生成时的当前输入</strong>{copyFields.map(([label, key]) => <div key={key}><span>{label}</span><p>{editing.candidate!.source[key] || "未填写"}</p></div>)}</div>
              <div className={styles.aiCompareColumn}><strong>AI 候选</strong>{copyFields.map(([label, key]) => <div key={key}><span>{label}</span><p>{editing.candidate!.candidate[key] || "未填写"}</p></div>)}</div>
            </div>
          </article> : null}
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>DRAFT HISTORY</span><h2>周报草稿</h2></div><span>{drafts.length} 条</span></div>
        {drafts.length ? <div className={styles.activityList}>{drafts.map((draft) => (
          <article key={draft.id} className={styles.activityCard}>
            <div className={styles.activityMeta}>
              <time dateTime={draft.weekStart}>{dateOnly(draft.weekStart)} — {dateOnly(draft.weekEnd)}</time>
              <span className={draft.status === "DRAFT" ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>{draft.status === "DRAFT" ? "草稿" : "已转动态"}</span>
              {sourceCounts(draft).map(([label, count]) => <span key={label} className={styles.statusBadge}>{label} {count}</span>)}
            </div>
            <div className={styles.activityCopy}><h3>{draft.titleZh}</h3><p>{draft.summaryZh}</p><small>{draft.titleEn}</small></div>
            <div className={styles.rowActions}>
              {draft.status === "DRAFT" ? <button type="button" onClick={() => openEditor(draft)}><FilePenLine size={15} />编辑</button> : null}
              {draft.status === "DRAFT" ? <button type="button" onClick={() => rewriteWithAi(draft)} disabled={isBusy(`weekly:ai:${draft.id}`)}>{isBusy(`weekly:ai:${draft.id}`) ? <LoaderCircle className={styles.spin} size={15} /> : <Sparkles size={15} />}AI 候选</button> : null}
              {draft.status === "DRAFT" ? <button type="button" onClick={() => convert(draft)} disabled={isBusy(`weekly:convert:${draft.id}`)}><Send size={15} />转为私有职业动态</button> : null}
            </div>
          </article>
        ))}</div> : <EmptyState title="还没有周报草稿" description="选择一周后生成，系统会汇总 GitHub、OKR、项目、文章和手工动态。" action={null} />}
      </section>

      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
