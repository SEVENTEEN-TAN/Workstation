"use client";

import {
  ArrowUpRight,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { getSkillAreaPublicIssues, getSkillAreaPublicNotes } from "../../lib/public-readiness";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { PublicReadiness } from "./okr/PublicReadiness";
import type { PortfolioProjectData, SkillAreaData, SkillData, SkillEvidenceData } from "./types";
import { adminRequest } from "./request";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

function id() {
  return globalThis.crypto.randomUUID();
}

function emptySkill(): SkillData {
  return {
    id: id(),
    areaId: "",
    nameZh: "",
    nameEn: null,
    summaryZh: "",
    summaryEn: null,
    visibility: "PRIVATE",
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    evidence: [],
  };
}

function emptyEvidence(projects: PortfolioProjectData[], sortOrder: number): SkillEvidenceData {
  const now = new Date().toISOString();
  const kind = projects.length ? "PROJECT" : "ARTICLE";
  return kind === "PROJECT" ? {
    id: id(),
    kind,
    projectId: projects[0]!.id,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  } : {
    id: id(),
    kind,
    titleZh: "",
    titleEn: null,
    url: "https://",
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

function newArea(): SkillAreaData {
  const now = new Date().toISOString();
  return {
    id: "",
    nameZh: "",
    nameEn: null,
    descriptionZh: "",
    descriptionEn: null,
    visibility: "PRIVATE",
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    skills: [],
  };
}

function sortAreas(areas: SkillAreaData[]) {
  return [...areas].sort((left, right) => left.sortOrder - right.sortOrder || right.updatedAt.localeCompare(left.updatedAt));
}

function text(data: FormData, name: string) {
  return String(data.get(name) ?? "");
}

export function SkillAreasWorkspace({
  initialAreas,
  projects,
}: {
  initialAreas: SkillAreaData[];
  projects: PortfolioProjectData[];
}) {
  const [areas, setAreas] = useState(() => sortAreas(initialAreas));
  const [editor, setEditor] = useState<SkillAreaData | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<SkillAreaData | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const saveBusy = isBusy("skills:save");
  const deleteBusy = deleteRequest ? isBusy(`skills:delete:${deleteRequest.id}`) : false;

  function openEditor(area: SkillAreaData | null) {
    setEditor(area ? structuredClone(area) : newArea());
  }

  function updateSkill(index: number, patch: Partial<SkillData>) {
    setEditor((current) => current && {
      ...current,
      skills: current.skills.map((skill, skillIndex) => skillIndex === index ? { ...skill, ...patch } : skill),
    });
  }

  function updateEvidence(skillIndex: number, evidenceIndex: number, evidence: SkillEvidenceData) {
    setEditor((current) => current && {
      ...current,
      skills: current.skills.map((skill, index) => index === skillIndex ? {
        ...skill,
        evidence: skill.evidence.map((item, itemIndex) => itemIndex === evidenceIndex ? evidence : item),
      } : skill),
    });
  }

  async function saveArea(event: FormEvent<HTMLFormElement>) {
    if (!editor) return;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      nameZh: text(data, "nameZh"),
      nameEn: text(data, "nameEn"),
      descriptionZh: text(data, "descriptionZh"),
      descriptionEn: text(data, "descriptionEn"),
      visibility: text(data, "visibility"),
      sortOrder: Number(text(data, "sortOrder")),
      skills: editor.skills.map((skill) => ({
        nameZh: skill.nameZh,
        nameEn: skill.nameEn,
        summaryZh: skill.summaryZh,
        summaryEn: skill.summaryEn,
        visibility: skill.visibility,
        sortOrder: skill.sortOrder,
        evidence: skill.evidence.map((item) => item.kind === "PROJECT"
          ? { kind: item.kind, projectId: item.projectId, sortOrder: item.sortOrder }
          : { kind: item.kind, titleZh: item.titleZh, titleEn: item.titleEn, url: item.url, sortOrder: item.sortOrder }),
      })),
    };
    const saved = await runAction("skills:save", () => adminRequest<SkillAreaData>(
      editor.id ? `/api/admin/skills/${editor.id}` : "/api/admin/skills",
      jsonRequest(editor.id ? "PATCH" : "POST", payload),
    ), editor.id ? "能力域已更新" : "能力域已创建");
    if (!saved) return;

    setAreas((current) => sortAreas(editor.id
      ? current.map((area) => area.id === saved.id ? saved : area)
      : [saved, ...current]));
    setEditor(null);
  }

  async function deleteArea() {
    if (!deleteRequest) return;
    const deleted = await runAction(`skills:delete:${deleteRequest.id}`, () => adminRequest<SkillAreaData>(
      `/api/admin/skills/${deleteRequest.id}`,
      { method: "DELETE" },
    ), "能力域已删除");
    if (!deleted) return;
    setAreas((current) => current.filter((area) => area.id !== deleteRequest.id));
    setDeleteRequest(null);
  }

  return (
    <section>
      <PageHeader
        title="能力矩阵"
        description="按能力域组织技能，并关联项目或文章作为可核查证据。"
        action={<button type="button" className={styles.primaryButton} onClick={() => openEditor(null)} disabled={saveBusy}><Plus size={17} />新建能力域</button>}
      />

      {editor ? (
        <section className={styles.panel} aria-labelledby="skill-editor-title">
          <div className={styles.sectionHeading}>
            <div><span className={styles.kicker}>{editor.id ? "EDIT" : "NEW"}</span><h2 id="skill-editor-title">{editor.id ? "编辑能力域" : "新建能力域"}</h2></div>
            <button type="button" className={styles.iconButton} aria-label="关闭编辑表单" onClick={() => setEditor(null)} disabled={saveBusy}><X size={18} /></button>
          </div>
          <form key={editor.id || "new"} className={styles.entityForm} onSubmit={saveArea}>
            <label><span>中文能力域名称</span><input name="nameZh" required maxLength={120} defaultValue={editor.nameZh} /></label>
            <label><span>英文能力域名称（公开必填）</span><input name="nameEn" maxLength={120} defaultValue={editor.nameEn ?? ""} /></label>
            <label className={styles.fullField}><span>中文能力域说明</span><textarea name="descriptionZh" required maxLength={1200} defaultValue={editor.descriptionZh} /></label>
            <label className={styles.fullField}><span>英文能力域说明（公开必填）</span><textarea name="descriptionEn" maxLength={1200} defaultValue={editor.descriptionEn ?? ""} /></label>
            <label><span>可见性</span><select name="visibility" defaultValue={editor.visibility}><option value="PRIVATE">私密</option><option value="PUBLIC">公开</option></select></label>
            <label><span>排序</span><input name="sortOrder" type="number" min="0" max="10000" required defaultValue={editor.sortOrder} /></label>

            <div className={styles.fullField}>
              <div className={styles.sectionHeading}>
                <div><span className={styles.kicker}>SKILLS</span><h3>技能与证据</h3></div>
                <button type="button" className={styles.iconTextButton} onClick={() => setEditor((current) => current && { ...current, skills: [...current.skills, emptySkill()] })}><Plus size={16} />添加技能</button>
              </div>
              {editor.skills.map((skill, skillIndex) => (
                <div key={skill.id} className={styles.capabilitySkillEditor}>
                  <div className={styles.sectionHeading}>
                    <h4>{skill.nameZh || `技能 ${skillIndex + 1}`}</h4>
                    <button type="button" aria-label={`删除技能 ${skill.nameZh || skillIndex + 1}`} onClick={() => setEditor((current) => current && { ...current, skills: current.skills.filter((_, index) => index !== skillIndex) })}><Trash2 size={15} />删除技能</button>
                  </div>
                  <div className={styles.entityForm}>
                    <label><span>中文技能名称</span><input value={skill.nameZh} onChange={(event) => updateSkill(skillIndex, { nameZh: event.target.value })} required maxLength={120} /></label>
                    <label><span>英文技能名称（公开必填）</span><input value={skill.nameEn ?? ""} onChange={(event) => updateSkill(skillIndex, { nameEn: event.target.value || null })} maxLength={120} /></label>
                    <label><span>中文技能说明</span><textarea value={skill.summaryZh} onChange={(event) => updateSkill(skillIndex, { summaryZh: event.target.value })} required maxLength={800} /></label>
                    <label><span>英文技能说明（公开必填）</span><textarea value={skill.summaryEn ?? ""} onChange={(event) => updateSkill(skillIndex, { summaryEn: event.target.value || null })} maxLength={800} /></label>
                    <label><span>技能可见性</span><select value={skill.visibility} onChange={(event) => updateSkill(skillIndex, { visibility: event.target.value as SkillData["visibility"] })}><option value="PRIVATE">私密</option><option value="PUBLIC">公开</option></select></label>
                    <label><span>技能排序</span><input type="number" min="0" max="10000" value={skill.sortOrder} onChange={(event) => updateSkill(skillIndex, { sortOrder: Number(event.target.value) })} /></label>
                  </div>
                  <div className={styles.entityForm}>
                    {skill.evidence.map((evidence, evidenceIndex) => (
                      <div key={evidence.id} className={styles.capabilityEvidenceEditor}>
                        <div className={styles.sectionHeading}>
                          <h5>{evidence.kind === "PROJECT" ? "项目证据" : "文章证据"}</h5>
                          <button type="button" aria-label="删除证据" onClick={() => updateSkill(skillIndex, {
                            evidence: skill.evidence.filter((_, index) => index !== evidenceIndex),
                          })}><Trash2 size={15} />删除证据</button>
                        </div>
                        <div className={styles.entityForm}>
                          <label><span>证据类型</span><select value={evidence.kind} onChange={(event) => updateEvidence(skillIndex, evidenceIndex, event.target.value === "PROJECT" ? {
                            id: evidence.id,
                            kind: "PROJECT",
                            projectId: projects[0]?.id ?? "",
                            sortOrder: evidence.sortOrder,
                            createdAt: evidence.createdAt,
                            updatedAt: evidence.updatedAt,
                          } : {
                            id: evidence.id,
                            kind: "ARTICLE",
                            titleZh: "",
                            titleEn: null,
                            url: "https://",
                            sortOrder: evidence.sortOrder,
                            createdAt: evidence.createdAt,
                            updatedAt: evidence.updatedAt,
                          })}><option value="PROJECT" disabled={!projects.length}>项目</option><option value="ARTICLE">文章</option></select>{!projects.length ? <small className={styles.fieldHint}>暂无项目，可先使用文章证据</small> : null}</label>
                          {evidence.kind === "PROJECT" ? (
                            <label><span>关联项目</span><select value={evidence.projectId} onChange={(event) => updateEvidence(skillIndex, evidenceIndex, { ...evidence, projectId: event.target.value })}>{projects.map((project) => <option key={project.id} value={project.id}>{project.titleZh}{project.visibility === "PRIVATE" ? "（私密）" : ""}</option>)}</select></label>
                          ) : (
                            <>
                              <label><span>中文文章标题</span><input value={evidence.titleZh} onChange={(event) => updateEvidence(skillIndex, evidenceIndex, { ...evidence, titleZh: event.target.value })} required maxLength={160} /></label>
                              <label><span>英文文章标题（公开必填）</span><input value={evidence.titleEn ?? ""} onChange={(event) => updateEvidence(skillIndex, evidenceIndex, { ...evidence, titleEn: event.target.value || null })} maxLength={160} /></label>
                              <label className={styles.fullField}><span>文章链接</span><input type="url" value={evidence.url} onChange={(event) => updateEvidence(skillIndex, evidenceIndex, { ...evidence, url: event.target.value })} required /></label>
                            </>
                          )}
                          <label><span>证据排序</span><input type="number" min="0" max="10000" value={evidence.sortOrder} onChange={(event) => updateEvidence(skillIndex, evidenceIndex, { ...evidence, sortOrder: Number(event.target.value) } as SkillEvidenceData)} /></label>
                        </div>
                      </div>
                    ))}
                    <button type="button" className={styles.iconTextButton} onClick={() => updateSkill(skillIndex, {
                      evidence: [...skill.evidence, emptyEvidence(projects, skill.evidence.length)],
                    })}><Plus size={16} />添加证据</button>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.entityFormActions}>
              <button type="button" onClick={() => setEditor(null)} disabled={saveBusy}>取消</button>
              <button className={styles.primaryButton} disabled={saveBusy}>{saveBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}{saveBusy ? "保存中" : "保存能力域"}</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>CAPABILITY</span><h2>能力域</h2></div><span>{areas.length} 组</span></div>
        {areas.length ? (
          <div className={styles.activityList}>{areas.map((area) => (
            <article key={area.id} className={styles.activityCard}>
              <div className={styles.activityMeta}>
                <span className={area.visibility === "PUBLIC" ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>{area.visibility === "PUBLIC" ? "公开" : "私密"}</span>
                <span className={styles.warningBadge}><Layers size={12} />{area.skills.length} 技能</span>
              </div>
              <div className={styles.activityCopy}>
                <h3>{area.nameZh}</h3>
                <p>{area.descriptionZh}</p>
                <small>{area.skills.map((skill) => skill.nameZh).join(" / ") || "尚未添加技能"}</small>
                <PublicReadiness
                  issues={getSkillAreaPublicIssues(area, projects)}
                  notes={getSkillAreaPublicNotes(area, projects)}
                  destination="能力页 /skills；首页能力区块"
                  nextStep="满足上述公开条件后由前台读取；部分技能或证据可能省略，无需发布首页。"
                />
              </div>
              <div className={styles.rowActions}>
                <a className={styles.iconTextButton} href="/skills" target="_blank" rel="noreferrer"><ArrowUpRight size={15} />公开页</a>
                <button type="button" aria-label={`编辑能力域 ${area.nameZh}`} onClick={() => openEditor(area)}><Pencil size={15} />编辑</button>
                <button type="button" aria-label={`删除能力域 ${area.nameZh}`} onClick={() => setDeleteRequest(area)}><Trash2 size={15} />删除</button>
              </div>
            </article>
          ))}</div>
        ) : <EmptyState title="还没有能力域" description="把技能按能力域整理，并关联项目或文章证据，让在线简历的能力说明可验证。" action={<button type="button" className={styles.primaryButton} onClick={() => openEditor(null)}><Plus size={17} />新建能力域</button>} />}
      </section>

      <ConfirmDialog open={Boolean(deleteRequest)} title="删除能力域" target={deleteRequest?.nameZh ?? ""} description="删除后该能力域及其技能、证据会一并移除。" busy={deleteBusy} triggerRef={undefined} onConfirm={deleteArea} onCancel={() => setDeleteRequest(null)} />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
