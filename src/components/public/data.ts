import { siteContentSchema, type SiteContent } from "../../lib/content/schema";
import type { PortfolioProjectRecord } from "../../lib/services/portfolio-projects";
import { calculateKeyResultProgress, calculateObjectiveProgress } from "../../lib/okr/progress";

export type PublicOkrKeyResultRecord = {
  id: string;
  titleZh: string;
  titleEn?: string | null;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
  mode: "METRIC" | "MANUAL";
  startValue?: number | null;
  currentValue?: number | null;
  targetValue?: number | null;
  manualProgress?: number | null;
  unit?: string | null;
  weight?: number | null;
  status: string;
};

export type PublicOkrObjectiveRecord = {
  id: string;
  titleZh: string;
  titleEn?: string | null;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
  status: string;
  visibility: "PUBLIC" | "PRIVATE";
  sortOrder: number;
  keyResults: PublicOkrKeyResultRecord[];
};

export type PublicOkrReviewRecord = {
  id: string;
  achievementsZh: string;
  achievementsEn?: string | null;
  problemsZh: string;
  problemsEn?: string | null;
  lessonsZh: string;
  lessonsEn?: string | null;
  nextActionsZh: string;
  nextActionsEn?: string | null;
  score?: number | null;
  visibility: "PUBLIC" | "PRIVATE";
  reviewedAt: string;
};

export type PublicOkrCycleRecord = {
  id: string;
  nameZh: string;
  nameEn?: string | null;
  type?: string;
  status: string;
  visibility: "PUBLIC" | "PRIVATE";
  startDate: string;
  endDate: string;
  objectives: PublicOkrObjectiveRecord[];
  reviews: PublicOkrReviewRecord[];
};

export type PublicOkrKeyResult = PublicOkrKeyResultRecord & { progress: number };
export type PublicOkrObjective = Omit<PublicOkrObjectiveRecord, "keyResults"> & {
  keyResults: PublicOkrKeyResult[];
  progress: number;
};
export type PublicOkrCycle = Omit<PublicOkrCycleRecord, "objectives" | "reviews"> & {
  objectives: PublicOkrObjective[];
  reviews: PublicOkrReviewRecord[];
};

export type PublicOkrView = {
  cycles: PublicOkrCycle[];
  summary: {
    averageProgress: number;
    completedObjectives: number;
    cycleCount: number;
    objectiveCount: number;
  };
};

export type PublicPortfolioProjectLink = {
  kind: "WEBSITE" | "SOURCE" | "DEMO" | "ARTICLE";
  labelZh: string;
  labelEn: string;
  url: string;
};

export type PublicPortfolioProject = {
  id: string;
  slug: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  contextZh: string;
  contextEn: string;
  responsibilityZh: string;
  responsibilityEn: string;
  challengeZh: string;
  challengeEn: string;
  approachZh: string;
  approachEn: string;
  resultZh: string;
  resultEn: string;
  coverImage: string | null;
  coverAltZh: string | null;
  coverAltEn: string | null;
  technologies: string[];
  links: PublicPortfolioProjectLink[];
  visibility: "PUBLIC";
  featured: boolean;
  sortOrder: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecentProjectView = {
  slug: string | null;
  image: string | null;
  category: string;
  title: string;
  description: string;
  tags: string[];
  alt: string;
};

type PublicDataSources = {
  loadPublishedSiteContent?: () => Promise<SiteContent | null>;
  loadPreviewSiteContent?: (version?: string) => Promise<SiteContent | null>;
  loadPublicOkrCycles?: () => Promise<PublicOkrCycleRecord[]>;
};

function keyResultProgress(keyResult: PublicOkrKeyResultRecord) {
  if (keyResult.mode === "MANUAL") {
    return calculateKeyResultProgress({ mode: "MANUAL", manualProgress: keyResult.manualProgress ?? 0 });
  }

  return calculateKeyResultProgress({
    mode: "METRIC",
    startValue: keyResult.startValue ?? 0,
    currentValue: keyResult.currentValue ?? keyResult.startValue ?? 0,
    targetValue: keyResult.targetValue ?? 0,
  });
}

export function toPublicOkrView(records: PublicOkrCycleRecord[]): PublicOkrView {
  const cycles = records
    .filter((cycle) => cycle.visibility === "PUBLIC")
    .map((cycle) => {
      const objectives = cycle.objectives
        .filter((objective) => objective.visibility === "PUBLIC")
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((objective) => {
          const keyResults = objective.keyResults.map((keyResult) => ({
            ...keyResult,
            progress: keyResultProgress(keyResult),
          }));
          return {
            ...objective,
            keyResults,
            progress: calculateObjectiveProgress(
              keyResults.map((keyResult) => ({ progress: keyResult.progress, weight: keyResult.weight ?? 1 })),
            ),
          };
        });

      return {
        ...cycle,
        objectives,
        reviews: cycle.reviews.filter((review) => review.visibility === "PUBLIC"),
      };
    });
  const objectives = cycles.flatMap((cycle) => cycle.objectives);
  const averageProgress = objectives.length
    ? Math.round((objectives.reduce((sum, objective) => sum + objective.progress, 0) / objectives.length) * 100) / 100
    : 0;

  return {
    cycles,
    summary: {
      averageProgress,
      completedObjectives: objectives.filter((objective) => objective.status === "COMPLETED").length,
      cycleCount: cycles.length,
      objectiveCount: objectives.length,
    },
  };
}

function isoValue(value: Date | string | null) {
  return value == null ? null : new Date(value).toISOString();
}

export function toPublicPortfolioProject(source: PortfolioProjectRecord): PublicPortfolioProject {
  if (source.visibility !== "PUBLIC") throw new Error("Only public projects can be rendered");
  if (
    !source.titleEn
    || !source.summaryEn
    || !source.contextEn
    || !source.responsibilityEn
    || !source.challengeEn
    || !source.approachEn
    || !source.resultEn
  ) throw new Error("Public projects require complete English evidence");
  if (source.coverImage && !source.coverAltEn) throw new Error("Public projects require English cover alt text");
  if (source.links.some((link) => !link.labelEn)) throw new Error("Public project links require English labels");

  return {
    id: source.id,
    slug: source.slug,
    titleZh: source.titleZh,
    titleEn: source.titleEn,
    summaryZh: source.summaryZh,
    summaryEn: source.summaryEn,
    contextZh: source.contextZh,
    contextEn: source.contextEn,
    responsibilityZh: source.responsibilityZh,
    responsibilityEn: source.responsibilityEn,
    challengeZh: source.challengeZh,
    challengeEn: source.challengeEn,
    approachZh: source.approachZh,
    approachEn: source.approachEn,
    resultZh: source.resultZh,
    resultEn: source.resultEn,
    coverImage: source.coverImage,
    coverAltZh: source.coverAltZh,
    coverAltEn: source.coverAltEn,
    technologies: source.technologies,
    links: source.links.map((link) => ({ ...link, labelEn: link.labelEn ?? "" })),
    visibility: "PUBLIC" as const,
    featured: source.featured,
    sortOrder: source.sortOrder,
    startedAt: isoValue(source.startedAt),
    completedAt: isoValue(source.completedAt),
    createdAt: new Date(source.createdAt).toISOString(),
    updatedAt: new Date(source.updatedAt).toISOString(),
  };
}

export function toRecentProjectViews(
  locale: "en" | "zh",
  projects: PublicPortfolioProject[],
  fallbackProjects: ReadonlyArray<SiteContent["en"]["projects"][number]>,
): RecentProjectView[] {
  if (projects.length) {
    return projects.map((project) => ({
      slug: project.slug,
      image: project.coverImage,
      category: project.technologies[0] ?? (locale === "zh" ? "项目" : "Project"),
      title: locale === "zh" ? project.titleZh : project.titleEn,
      description: locale === "zh" ? project.summaryZh : project.summaryEn,
      tags: project.technologies.slice(0, 4),
      alt: (locale === "zh" ? project.coverAltZh : project.coverAltEn) ?? project.titleEn,
    }));
  }

  return fallbackProjects.map((project) => ({
    slug: null,
    image: project.image,
    category: project.category,
    title: project.title,
    description: project.description,
    tags: project.tags,
    alt: project.alt,
  }));
}

export function createPublicDataAdapter(sources: PublicDataSources = {}) {
  return {
    async getPublishedSiteContent() {
      const content = await sources.loadPublishedSiteContent?.();
      return content ? siteContentSchema.parse(content) : null;
    },
    async getPreviewSiteContent(version?: string) {
      const preview = await sources.loadPreviewSiteContent?.(version);
      if (preview) return siteContentSchema.parse(preview);
      const published = await sources.loadPublishedSiteContent?.();
      return published ? siteContentSchema.parse(published) : null;
    },
    async getPublicOkrView() {
      return toPublicOkrView((await sources.loadPublicOkrCycles?.()) ?? []);
    },
  };
}

const defaultAdapter = createPublicDataAdapter();

export const getPublishedSiteContent = defaultAdapter.getPublishedSiteContent;
export const getPreviewSiteContent = defaultAdapter.getPreviewSiteContent;
export const getPublicOkrView = defaultAdapter.getPublicOkrView;
