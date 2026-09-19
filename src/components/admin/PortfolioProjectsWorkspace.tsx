"use client";

import { Check, ExternalLink, ImageIcon, LoaderCircle, Pencil, Plus, Save, Sparkles, Star, Trash2, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { AssetPicker } from "./home/AssetPicker";
import { adminRequest } from "./request";
import type { AssetData, PortfolioProjectData, ProjectAiContentDraftData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

const LINK_KINDS = ["WEBSITE", "SOURCE", "DEMO", "ARTICLE"] as const;

type LinkDraft = {
  kind: (typeof LINK_KINDS)[number];
  labelZh: string;
  labelEn: string;
  url: string;
};

type Editor = PortfolioProjectData | "new" | null;

function sortProjects(items: PortfolioProjectData[]) {
  return [...items].sort((left, right) => Number(right.featured) - Number(left.featured)
    || left.sortOrder - right.sortOrder
    || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function serializeProject(project: PortfolioProjectData) {
  return structuredClone(project);
}

function dateValue(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function text(data: FormData, name: string) {
  return String(data.get(name) ?? "");
}

function formPayload(form: HTMLFormElement) {
  const data = new FormData(form);
  const kinds = data.getAll("linkKind").map(String);
  const labelsZh = data.getAll("linkLabelZh").map(String);
  const labelsEn = data.getAll("linkLabelEn").map(String);
  const urls = data.getAll("linkUrl").map(String);
  const technologies = text(data, "technologies")
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    slug: text(data, "slug"),
    titleZh: text(data, "titleZh"),
    titleEn: text(data, "titleEn"),
    summaryZh: text(data, "summaryZh"),
    summaryEn: text(data, "summaryEn"),
    contextZh: text(data, "contextZh"),
    contextEn: text(data, "contextEn"),
    responsibilityZh: text(data, "responsibilityZh"),
    responsibilityEn: text(data, "responsibilityEn"),
    challengeZh: text(data, "challengeZh"),
    challengeEn: text(data, "challengeEn"),
    approachZh: text(data, "approachZh"),
    approachEn: text(data, "approachEn"),
    resultZh: text(data, "resultZh"),
    resultEn: text(data, "resultEn"),
    coverImage: text(data, "coverImage"),
    coverAltZh: text(data, "coverAltZh"),
    coverAltEn: text(data, "coverAltEn"),
    technologies,
    links: kinds.map((kind, index) => ({
      kind,
      labelZh: labelsZh[index] ?? "",
      labelEn: labelsEn[index] ?? "",
      url: urls[index] ?? "",
    })),
    visibility: text(data, "visibility"),
    featured: data.get("featured") === "on",
    sortOrder: Number(data.get("sortOrder") ?? 0),
    startedAt: text(data, "startedAt"),
    completedAt: text(data, "completedAt"),
  };
}

export function PortfolioProjectsWorkspace({
  initialProjects,
  assets,
  initialAiDrafts,
}: {
  initialProjects: PortfolioProjectData[];
  assets: AssetData[];
  initialAiDrafts: ProjectAiContentDraftData[];
}) {
  const [projects, setProjects] = useState(() => sortProjects(initialProjects));
  const [aiDrafts, setAiDrafts] = useState(initialAiDrafts);
  const [editor, setEditor] = useState<Editor>(null);
  const [coverImage, setCoverImage] = useState("");
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [links, setLinks] = useState<LinkDraft[]>([]);
  const [deleteRequest, setDeleteRequest] = useState<PortfolioProjectData | null>(null);
  const assetPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const saveBusy = isBusy("projects:save");
  const deleteBusy = deleteRequest ? isBusy(`projects:delete:${deleteRequest.id}`) : false;

  function openEditor(next: Exclude<Editor, null>) {
    setEditor(next);
    setCoverImage(next === "new" ? "" : next.coverImage ?? "");
    setLinks(next === "new" ? [] : next.links.map((link) => ({
      kind: link.kind,
      labelZh: link.labelZh,
      labelEn: link.labelEn ?? "",
      url: link.url,
    })));
  }

  function closeEditor() {
    setEditor(null);
    setCoverImage("");
    setLinks([]);
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const editing = editor !== null && editor !== "new" ? editor : null;
    const saved = await runAction("projects:save", () => adminRequest<PortfolioProjectData>(
      editing ? `/api/admin/projects/${editing.id}` : "/api/admin/projects",
      jsonRequest(editing ? "PATCH" : "POST", formPayload(form)),
    ), editing ? "项目证据已更新" : "项目证据已创建");
    if (!saved) return;

    const project = serializeProject(saved);
    setProjects((current) => sortProjects(editing
      ? current.map((item) => item.id === project.id ? project : item)
      : [project, ...current]));
    closeEditor();
  }

  async function deleteProject() {
    if (!deleteRequest) return;
    const deleted = await runAction(`projects:delete:${deleteRequest.id}`, () => adminRequest<PortfolioProjectData>(
      `/api/admin/projects/${deleteRequest.id}`,
      { method: "DELETE" },
    ), "项目证据已删除");
    if (!deleted) return;
    setProjects((current) => current.filter((item) => item.id !== deleteRequest.id));
    setDeleteRequest(null);
  }

  async function generateAiDraft(project: PortfolioProjectData) {
    const draft = await runAction(`projects:ai:${project.id}`, () => adminRequest<ProjectAiContentDraftData>(
      "/api/admin/ai/drafts",
      jsonRequest("POST", { useCase: "PROJECT_DESCRIPTION", targetId: project.id }),
    ), "AI 项目说明草稿已生成");
    if (!draft) return;
    setAiDrafts((current) => [draft, ...current.filter((item) => item.targetId !== project.id)]);
  }

  async function applyAiDraft(draft: ProjectAiContentDraftData) {
    const applied = await runAction(`projects:ai:apply:${draft.id}`, () => adminRequest<ProjectAiContentDraftData>(
      `/api/admin/ai/drafts/${draft.id}/apply`, { method: "POST" },
    ), "AI 草稿已应用到项目");
    if (!applied) return;
    setProjects((current) => sortProjects(current.map((project) => project.id === draft.targetId
      ? { ...project, ...draft.content, updatedAt: new Date().toISOString() }
      : project)));
    setAiDrafts((current) => current.filter((item) => item.id !== draft.id));
  }

  async function discardAiDraft(draft: ProjectAiContentDraftData) {
    const discarded = await runAction(`projects:ai:discard:${draft.id}`, () => adminRequest<ProjectAiContentDraftData>(
      `/api/admin/ai/drafts/${draft.id}`, { method: "DELETE" },
    ), "AI 草稿已丢弃");
    if (discarded) setAiDrafts((current) => current.filter((item) => item.id !== draft.id));
  }

  const editing = editor !== null && editor !== "new" ? editor : null;

  return (
    <section>
      <PageHeader
        title="项目证据"
        description="维护可公开核查的项目背景、职责、挑战、方案、结果与相关链接。"
        action={<button type="button" className={styles.primaryButton} onClick={() => openEditor("new")} disabled={saveBusy}><Plus size={17} />新建项目</button>}
      />

      {editor ? (
        <section className={styles.panel} aria-labelledby="project-editor-title">
          <div className={styles.sectionHeading}>
            <div><span className={styles.kicker}>{editing ? "EDIT" : "NEW"}</span><h2 id="project-editor-title">{editing ? "编辑项目证据" : "新建项目证据"}</h2></div>
            <button type="button" className={styles.iconButton} aria-label="关闭编辑表单" onClick={closeEditor} disabled={saveBusy}><X size={18} /></button>
          </div>
          <form key={editing?.id ?? "new"} className={styles.entityForm} onSubmit={saveProject}>
            <label><span>Slug</span><input name="slug" required maxLength={100} defaultValue={editing?.slug ?? ""} /></label>
            <label><span>排序</span><input name="sortOrder" type="number" min={0} step={1} defaultValue={editing?.sortOrder ?? 0} /></label>
            <label><span>中文标题</span><input name="titleZh" required maxLength={120} defaultValue={editing?.titleZh ?? ""} /></label>
            <label><span>英文标题（公开必填）</span><input name="titleEn" maxLength={120} defaultValue={editing?.titleEn ?? ""} /></label>
            <label><span>中文摘要</span><textarea name="summaryZh" required maxLength={600} defaultValue={editing?.summaryZh ?? ""} /></label>
            <label><span>英文摘要（公开必填）</span><textarea name="summaryEn" maxLength={600} defaultValue={editing?.summaryEn ?? ""} /></label>
            <label><span>中文项目背景</span><textarea name="contextZh" required defaultValue={editing?.contextZh ?? ""} /></label>
            <label><span>英文项目背景（公开必填）</span><textarea name="contextEn" defaultValue={editing?.contextEn ?? ""} /></label>
            <label><span>中文职责</span><textarea name="responsibilityZh" required defaultValue={editing?.responsibilityZh ?? ""} /></label>
            <label><span>英文职责（公开必填）</span><textarea name="responsibilityEn" defaultValue={editing?.responsibilityEn ?? ""} /></label>
            <label><span>中文挑战</span><textarea name="challengeZh" required defaultValue={editing?.challengeZh ?? ""} /></label>
            <label><span>英文挑战（公开必填）</span><textarea name="challengeEn" defaultValue={editing?.challengeEn ?? ""} /></label>
            <label><span>中文方案</span><textarea name="approachZh" required defaultValue={editing?.approachZh ?? ""} /></label>
            <label><span>英文方案（公开必填）</span><textarea name="approachEn" defaultValue={editing?.approachEn ?? ""} /></label>
            <label><span>中文结果</span><textarea name="resultZh" required defaultValue={editing?.resultZh ?? ""} /></label>
            <label><span>英文结果（公开必填）</span><textarea name="resultEn" defaultValue={editing?.resultEn ?? ""} /></label>

            <div className={`${styles.fullField} ${styles.assetFieldControl}`}>
              <label htmlFor="project-cover-image"><span>封面路径或 URL</span><input id="project-cover-image" name="coverImage" value={coverImage} onChange={(event) => setCoverImage(event.target.value)} maxLength={2048} /></label>
              <button type="button" className={styles.secondaryButton} onClick={(event) => { assetPickerTriggerRef.current = event.currentTarget; setAssetPickerOpen(true); }}><ImageIcon size={17} />选择媒体</button>
            </div>
            <label><span>中文封面替代文本</span><input name="coverAltZh" maxLength={240} defaultValue={editing?.coverAltZh ?? ""} /></label>
            <label><span>英文封面替代文本（公开必填）</span><input name="coverAltEn" maxLength={240} defaultValue={editing?.coverAltEn ?? ""} /></label>

            <label className={styles.fullField}><span>技术栈（逗号或换行分隔）</span><textarea name="technologies" required defaultValue={editing?.technologies.join("\n") ?? ""} /></label>

            <label><span>开始日期</span><input name="startedAt" type="date" defaultValue={dateValue(editing?.startedAt)} /></label>
            <label><span>完成日期</span><input name="completedAt" type="date" defaultValue={dateValue(editing?.completedAt)} /></label>
            <label><span>可见性</span><select name="visibility" defaultValue={editing?.visibility ?? "PRIVATE"}><option value="PRIVATE">私密</option><option value="PUBLIC">公开</option></select></label>
            <label className={`${styles.fullField} ${styles.activityToggle}`}><input name="featured" type="checkbox" defaultChecked={editing?.featured ?? false} /><span><strong>设为精选</strong><small>精选项目会优先出现在首页和项目列表。</small></span></label>

            <div className={`${styles.fullField} ${styles.projectLinkEditor}`}>
              <div className={styles.sectionHeading}>
                <h3>相关链接</h3>
                <button type="button" className={styles.secondaryButton} onClick={() => setLinks((current) => [...current, { kind: "WEBSITE", labelZh: "", labelEn: "", url: "" }])} disabled={links.length >= 8}><Plus size={16} />添加链接</button>
              </div>
              {links.length ? links.map((link, index) => (
                <div className={styles.projectLinkRow} key={`project-link-${index}`}>
                  <label><span>类型</span><select name="linkKind" value={link.kind} onChange={(event) => setLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, kind: event.target.value as LinkDraft["kind"] } : item))}>{LINK_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
                  <label><span>中文名称</span><input name="linkLabelZh" value={link.labelZh} onChange={(event) => setLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, labelZh: event.target.value } : item))} maxLength={80} /></label>
                  <label><span>英文名称</span><input name="linkLabelEn" value={link.labelEn} onChange={(event) => setLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, labelEn: event.target.value } : item))} maxLength={80} /></label>
                  <label><span>地址</span><input name="linkUrl" type="url" value={link.url} onChange={(event) => setLinks((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item))} maxLength={2048} /></label>
                  <button type="button" aria-label={`删除链接 ${index + 1}`} onClick={() => setLinks((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
                </div>
              )) : <p className={styles.mutedCopy}>暂无相关链接。</p>}
            </div>

            <div className={styles.entityFormActions}>
              <button type="button" onClick={closeEditor} disabled={saveBusy}>取消</button>
              <button className={styles.primaryButton} disabled={saveBusy}>{saveBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}{saveBusy ? "保存中" : "保存项目"}</button>
            </div>
          </form>
        </section>
      ) : null}

      {aiDrafts.length ? (
        <section className={styles.panel}>
          <div className={styles.sectionHeading}><div><span className={styles.kicker}>AI DRAFT REVIEW</span><h2>项目说明草稿审核</h2></div><span>{aiDrafts.length} 条待处理</span></div>
          <div className={styles.aiDraftList}>{aiDrafts.map((draft) => {
            const project = projects.find((item) => item.id === draft.targetId);
            const fields = [
              ["摘要", "summaryZh"], ["背景", "contextZh"], ["职责", "responsibilityZh"],
              ["挑战", "challengeZh"], ["方案", "approachZh"], ["结果", "resultZh"],
            ] as const;
            return (
              <article className={styles.aiDraftCard} key={draft.id}>
                <div className={styles.aiDraftHeader}>
                  <div><span className={styles.statusBadge}>私密草稿</span><h3>{project?.titleZh ?? "项目已不存在"}</h3><small>{draft.model} · {new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(draft.generatedAt))}</small></div>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.primaryButton} onClick={() => applyAiDraft(draft)} disabled={isBusy(`projects:ai:apply:${draft.id}`)}><Check size={15} />应用草稿</button>
                    <button type="button" onClick={() => discardAiDraft(draft)} disabled={isBusy(`projects:ai:discard:${draft.id}`)}><Trash2 size={15} />丢弃草稿</button>
                  </div>
                </div>
                <div className={styles.aiCompareGrid}>
                  <div className={styles.aiCompareColumn}><strong>来源内容</strong>{fields.map(([label, key]) => <div key={key}><span>{label}</span><p>{String(draft.sourceSnapshot[key] ?? "未填写")}</p></div>)}</div>
                  <div className={styles.aiCompareColumn}><strong>生成草稿</strong>{fields.map(([label, key]) => <div key={key}><span>{label}</span><p>{String(draft.content[key] ?? "未生成")}</p></div>)}</div>
                </div>
              </article>
            );
          })}</div>
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>PROJECT EVIDENCE</span><h2>项目记录</h2></div><span>{projects.length} 个</span></div>
        {projects.length ? (
          <div className={styles.projectList}>{projects.map((project) => (
            <article key={project.id} className={styles.projectCard}>
              <div className={styles.activityMeta}>
                <span className={project.visibility === "PUBLIC" ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>{project.visibility === "PUBLIC" ? "公开" : "私密"}</span>
                {project.featured ? <span className={styles.warningBadge}><Star size={12} />精选</span> : null}
                {project.startedAt ? <time dateTime={project.startedAt}>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(project.startedAt))}</time> : null}
              </div>
              <div className={styles.activityCopy}>
                <h3>{project.titleZh}</h3>
                <p>{project.summaryZh}</p>
                {project.titleEn ? <small>{project.titleEn}</small> : null}
                <div className={styles.projectTechnologies}>{project.technologies.slice(0, 6).map((technology) => <span key={technology}>{technology}</span>)}</div>
              </div>
              <div className={styles.rowActions}>
                {project.links[0] ? <a className={styles.iconTextButton} href={project.links[0].url} target="_blank" rel="noreferrer"><ExternalLink size={15} />打开链接</a> : null}
                <button type="button" onClick={() => generateAiDraft(project)} disabled={isBusy(`projects:ai:${project.id}`)}>{isBusy(`projects:ai:${project.id}`) ? <LoaderCircle className={styles.spin} size={15} /> : <Sparkles size={15} />}AI 整理说明</button>
                <button type="button" aria-label={`编辑项目 ${project.titleZh}`} onClick={() => openEditor(project)}><Pencil size={15} />编辑</button>
                <button type="button" aria-label={`删除项目 ${project.titleZh}`} onClick={() => setDeleteRequest(project)}><Trash2 size={15} />删除</button>
              </div>
            </article>
          ))}</div>
        ) : <EmptyState title="还没有项目证据" description="把重要项目整理为背景、职责、挑战、方案和结果，形成可验证的在线简历证据。" action={<button type="button" className={styles.primaryButton} onClick={() => openEditor("new")}><Plus size={17} />新建项目</button>} />}
      </section>

      <AssetPicker
        assets={assets}
        open={assetPickerOpen}
        triggerRef={assetPickerTriggerRef}
        onSelect={(asset) => { setCoverImage(`/api/assets/${asset.id}`); setAssetPickerOpen(false); }}
        onClose={() => setAssetPickerOpen(false)}
      />
      <ConfirmDialog open={Boolean(deleteRequest)} title="删除项目证据" target={deleteRequest?.titleZh ?? ""} description="删除后无法恢复，公开首页和项目详情也会立即停止展示。" busy={deleteBusy} triggerRef={undefined} onConfirm={deleteProject} onCancel={() => setDeleteRequest(null)} />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
