import type { PortfolioProjectInput } from "../validators/portfolio-projects";
import type { SiteVersionRecord } from "../services/site-content";
import { portfolioProjectInputSchema } from "../validators/portfolio-projects";
import { siteContentSchema, type SiteContent } from "./schema";

export type HomepageProjectCandidate = Omit<
  PortfolioProjectInput,
  "startedAt" | "completedAt"
> & {
  id: string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
};

const HOMEPAGE_PROJECT_FIELDS = ["slug", "image", "category", "title", "description", "tags", "alt"] as const;
export type HomepageProjectField = (typeof HOMEPAGE_PROJECT_FIELDS)[number];
type HomepageProjectCard = SiteContent["zh"]["projects"][number];

export type HomepageProjectSync = {
  status: "legacy" | "synced" | "pending" | "blocked";
  changes: Array<{
    id: string;
    name: string;
    fields: Array<{ locale: "zh" | "en"; field: HomepageProjectField }>;
  }>;
  unavailable: Array<{
    id: string;
    name: string;
    reason: "missing" | "private" | "incomplete";
  }>;
  extraCards: boolean;
};

function isSelectableProject(project: HomepageProjectCandidate) {
  return project.visibility === "PUBLIC" && portfolioProjectInputSchema.safeParse(project).success;
}

function sameCardField(actual: HomepageProjectCard | undefined, expected: HomepageProjectCard | undefined, field: HomepageProjectField) {
  if (!actual || !expected) return false;
  if (field === "tags") {
    return actual.tags.length === expected.tags.length &&
      actual.tags.every((tag, index) => tag === expected.tags[index]);
  }
  return actual[field] === expected[field];
}

export function homepageProjectCardsMatch(actual: SiteContent, expected: SiteContent): boolean {
  return (["zh", "en"] as const).every((locale) => {
    const actualCards = actual[locale].projects;
    const expectedCards = expected[locale].projects;
    return actualCards.length === expectedCards.length &&
      actualCards.every((card, index) =>
        HOMEPAGE_PROJECT_FIELDS.every((field) => sameCardField(card, expectedCards[index], field)));
  });
}

export function inspectHomepageProjectSync(
  saved: SiteContent,
  projects: HomepageProjectCandidate[],
): HomepageProjectSync {
  const empty: HomepageProjectSync = { status: "legacy", changes: [], unavailable: [], extraCards: false };
  const ids = saved.selectedProjectIds;
  if (ids === undefined) return empty;

  const byId = new Map(projects.map((project) => [project.id, project]));
  const name = (id: string, index: number) =>
    byId.get(id)?.titleZh?.trim() || saved.zh.projects[index]?.title || id;
  const unavailable = ids.flatMap((id, index) => {
    const project = byId.get(id);
    const reason: HomepageProjectSync["unavailable"][number]["reason"] | null = !project ? "missing"
      : project.visibility !== "PUBLIC" ? "private"
      : !portfolioProjectInputSchema.safeParse(project).success ? "incomplete"
      : null;
    return reason ? [{ id, name: name(id, index), reason }] : [];
  });
  const extraCards = (["zh", "en"] as const)
    .some((locale) => saved[locale].projects.length > ids.length);
  if (unavailable.length) return { ...empty, status: "blocked", unavailable, extraCards };

  const expected = materializeHomepageProjects(saved, projects);
  const changes = ids.flatMap((id, index) => {
    const fields = (["zh", "en"] as const).flatMap((locale) =>
      HOMEPAGE_PROJECT_FIELDS
        .filter((field) => !sameCardField(saved[locale].projects[index], expected[locale].projects[index], field))
        .map((field) => ({ locale, field })));
    return fields.length ? [{ id, name: name(id, index), fields }] : [];
  });
  return {
    status: changes.length || !homepageProjectCardsMatch(saved, expected) ? "pending" : "synced",
    changes,
    unavailable: [],
    extraCards,
  };
}

function toLocalizedProject(project: HomepageProjectCandidate, locale: "en" | "zh") {
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
  projects: HomepageProjectCandidate[],
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

export function materializeHomepageProjectsForPreview(
  content: SiteContent,
  projects: HomepageProjectCandidate[],
): SiteContent {
  try {
    return materializeHomepageProjects(content, projects);
  } catch {
    return content;
  }
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
