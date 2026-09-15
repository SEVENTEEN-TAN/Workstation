import type { PortfolioProjectRecord } from "../services/portfolio-projects";
import type { SiteVersionRecord } from "../services/site-content";
import { portfolioProjectInputSchema } from "../validators/portfolio-projects";
import { siteContentSchema, type SiteContent } from "./schema";

function isSelectableProject(project: PortfolioProjectRecord) {
  return project.visibility === "PUBLIC" && portfolioProjectInputSchema.safeParse(project).success;
}

function toLocalizedProject(project: PortfolioProjectRecord, locale: "en" | "zh") {
  const title = locale === "zh" ? project.titleZh : project.titleEn;
  const description = locale === "zh" ? project.summaryZh : project.summaryEn;
  if (!title || !description) throw new Error("主页引用的项目不存在或不可公开");
  return {
    slug: project.slug,
    image: project.coverImage ?? "",
    category: project.technologies[0] ?? (locale === "zh" ? "项目" : "Project"),
    title,
    description,
    tags: project.technologies.slice(0, 4),
    alt: (locale === "zh" ? project.coverAltZh : project.coverAltEn) ?? title,
  };
}

export function materializeHomepageProjects(
  content: SiteContent,
  projects: PortfolioProjectRecord[],
): SiteContent {
  const selectedProjectIds = content.selectedProjectIds;
  if (!selectedProjectIds) return content;

  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const selectedProjects = selectedProjectIds.map((id) => {
    const project = projectsById.get(id);
    if (!project || !isSelectableProject(project)) throw new Error("主页引用的项目不存在或不可公开");
    return project;
  });

  return {
    ...content,
    en: { ...content.en, projects: selectedProjects.map((project) => toLocalizedProject(project, "en")) },
    zh: { ...content.zh, projects: selectedProjects.map((project) => toLocalizedProject(project, "zh")) },
  };
}

export function findHomepageProjectReferences(
  projectId: string,
  versions: SiteVersionRecord[],
): SiteVersionRecord[] {
  return versions.filter((version) => {
    const content = siteContentSchema.safeParse(version.content);
    return content.success && content.data.selectedProjectIds?.includes(projectId) === true;
  });
}
