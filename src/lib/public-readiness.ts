type Visibility = "PUBLIC" | "PRIVATE" | string;

type PortfolioProjectReadiness = {
  id?: string;
  titleZh?: string;
  titleEn?: string | null;
  summaryEn?: string | null;
  contextEn?: string | null;
  responsibilityEn?: string | null;
  challengeEn?: string | null;
  approachEn?: string | null;
  resultEn?: string | null;
  coverImage?: string | null;
  coverAltEn?: string | null;
  links?: Array<{ labelZh?: string; labelEn?: string | null }>;
  visibility: Visibility;
  publicReady?: boolean;
};

type SkillEvidenceReadiness =
  | { kind: "ARTICLE"; titleZh?: string; titleEn?: string | null }
  | { kind: "PROJECT"; projectId: string };

type SkillReadiness = {
  nameZh: string;
  nameEn?: string | null;
  summaryEn?: string | null;
  visibility: Visibility;
  evidence: SkillEvidenceReadiness[];
};

type SkillAreaReadiness = {
  visibility: Visibility;
  nameEn?: string | null;
  descriptionEn?: string | null;
  skills: SkillReadiness[];
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function getPortfolioProjectPublicIssues(project: PortfolioProjectReadiness): string[] {
  if (project.publicReady === true) return [];
  const issues = [
    ...(project.visibility !== "PUBLIC" ? ["当前设为私密"] : []),
    ...(!hasText(project.titleEn) ? ["缺少英文标题"] : []),
    ...(!hasText(project.summaryEn) ? ["缺少英文摘要"] : []),
    ...(!hasText(project.contextEn) ? ["缺少英文项目背景"] : []),
    ...(!hasText(project.responsibilityEn) ? ["缺少英文职责"] : []),
    ...(!hasText(project.challengeEn) ? ["缺少英文挑战"] : []),
    ...(!hasText(project.approachEn) ? ["缺少英文方案"] : []),
    ...(!hasText(project.resultEn) ? ["缺少英文结果"] : []),
    ...(hasText(project.coverImage) && !hasText(project.coverAltEn) ? ["缺少英文封面替代文本"] : []),
  ];
  return issues.concat((project.links ?? []).flatMap((link, index) => (
    hasText(link.labelEn) ? [] : [`链接「${link.labelZh?.trim() || index + 1}」缺少英文名称`]
  )));
}

export function getExperiencePublicIssues(record: {
  visibility: Visibility;
  organizationEn?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
  locationZh?: string | null;
  locationEn?: string | null;
}): string[] {
  return [
    ...(record.visibility !== "PUBLIC" ? ["当前设为私密"] : []),
    ...(!hasText(record.organizationEn) ? ["缺少英文机构名称"] : []),
    ...(!hasText(record.titleEn) ? ["缺少英文职位或专业"] : []),
    ...(!hasText(record.descriptionEn) ? ["缺少英文描述"] : []),
    ...(hasText(record.locationZh) && !hasText(record.locationEn) ? ["缺少英文地点"] : []),
  ];
}

export function getCareerActivityPublicIssues(activity: {
  visibility: Visibility;
  titleEn?: string | null;
  summaryEn?: string | null;
}): string[] {
  return [
    ...(activity.visibility !== "PUBLIC" ? ["当前设为私密"] : []),
    ...(!hasText(activity.titleEn) ? ["缺少英文标题"] : []),
    ...(!hasText(activity.summaryEn) ? ["缺少英文摘要"] : []),
  ];
}

function projectById(projects: PortfolioProjectReadiness[]) {
  return new Map(projects.flatMap((project) => project.id ? [[project.id, project] as const] : []));
}

function isUsableEvidence(evidence: SkillEvidenceReadiness, projects: Map<string, PortfolioProjectReadiness>) {
  if (evidence.kind === "ARTICLE") return hasText(evidence.titleEn);
  const project = projects.get(evidence.projectId);
  return Boolean(project && getPortfolioProjectPublicIssues(project).length === 0);
}

export function getSkillPublicIssues(skill: SkillReadiness, projects: PortfolioProjectReadiness[]): string[] {
  const projectsById = projectById(projects);
  return [
    ...(skill.visibility !== "PUBLIC" ? ["当前设为私密"] : []),
    ...(!hasText(skill.nameEn) ? ["缺少英文名称"] : []),
    ...(!hasText(skill.summaryEn) ? ["缺少英文说明"] : []),
    ...skill.evidence.flatMap((evidence) => evidence.kind === "ARTICLE" && !hasText(evidence.titleEn)
      ? [`文章证据「${evidence.titleZh?.trim() || "未命名"}」缺少英文标题`]
      : []),
    ...(!skill.evidence.some((evidence) => isUsableEvidence(evidence, projectsById))
      ? ["没有可在前台展示的证据"]
      : []),
  ];
}

export function getSkillAreaPublicIssues(area: SkillAreaReadiness, projects: PortfolioProjectReadiness[]): string[] {
  const hasPublicSkill = area.skills.some((skill) => (
    skill.visibility === "PUBLIC" && getSkillPublicIssues(skill, projects).length === 0
  ));
  return [
    ...(area.visibility !== "PUBLIC" ? ["当前设为私密"] : []),
    ...(!hasText(area.nameEn) ? ["缺少英文名称"] : []),
    ...(!hasText(area.descriptionEn) ? ["缺少英文说明"] : []),
    ...(!hasPublicSkill ? ["没有满足前台展示条件的公开技能"] : []),
  ];
}

export function getSkillAreaPublicNotes(area: SkillAreaReadiness, projects: PortfolioProjectReadiness[]): string[] {
  const projectsById = projectById(projects);
  return area.skills.filter((skill) => skill.visibility === "PUBLIC").flatMap((skill) => {
    const issues = getSkillPublicIssues(skill, projects);
    const skillNotes = issues.length ? [`技能「${skill.nameZh}」暂不展示：${issues.join("、")}`] : [];
    const evidenceNotes = skill.evidence.flatMap((evidence) => {
      if (evidence.kind !== "PROJECT") return [];
      const project = projectsById.get(evidence.projectId);
      if (!project) return [`技能「${skill.nameZh}」的项目证据「${evidence.projectId}」：关联项目不存在`];
      const projectIssues = getPortfolioProjectPublicIssues(project);
      return projectIssues.length
        ? [`技能「${skill.nameZh}」的项目证据「${project.titleZh?.trim() || evidence.projectId}」：关联项目${projectIssues.join("、")}`]
        : [];
    });
    return [...skillNotes, ...evidenceNotes];
  });
}

export function getResumeFilePublicIssues(file: { visibility: Visibility } | null | undefined): string[] {
  if (!file) return ["尚未上传文件"];
  return file.visibility === "PUBLIC" ? [] : ["当前设为私密"];
}
