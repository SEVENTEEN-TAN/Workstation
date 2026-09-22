import { siteContentSchema, type SiteContent } from "../content/schema";
import { getDatabase } from "../db";
import { getCyclePublicIssues, getObjectivePublicIssues, getReviewPublicIssues } from "../okr/public-readiness";
import type {
  PublicOkrCycleRecord,
  PublicOkrKeyResultRecord,
  PublicOkrObjectiveRecord,
  PublicOkrReviewRecord,
} from "../../components/public/data";

type PublicDataSource = {
  findPublishedSiteVersion(): Promise<{ content: unknown } | null>;
  findOkrCycles(): Promise<PublicCycleSourceRecord[]>;
};

type PublicReviewSourceRecord = {
  id: string;
  visibility: string;
  achievementsZh: string;
  achievementsEn?: string | null;
  problemsZh: string;
  problemsEn?: string | null;
  lessonsZh: string;
  lessonsEn?: string | null;
  nextActionsZh: string;
  nextActionsEn?: string | null;
  score?: number | null;
  reviewedAt: Date;
};

type PublicKeyResultSourceRecord = {
  id: string;
  titleZh: string;
  titleEn?: string | null;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
  progressMode: string;
  startValue?: number | null;
  currentValue?: number | null;
  targetValue?: number | null;
  manualProgress?: number | null;
  unit?: string | null;
  weight?: number | null;
  status: string;
};

type PublicObjectiveSourceRecord = {
  id: string;
  visibility: string;
  sortOrder: number;
  titleZh: string;
  titleEn?: string | null;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
  status: string;
  keyResults: PublicKeyResultSourceRecord[];
};

type PublicCycleSourceRecord = {
  id: string;
  visibility: string;
  nameZh: string;
  nameEn?: string | null;
  type?: string;
  status: string;
  startDate: Date;
  endDate: Date;
  objectives: PublicObjectiveSourceRecord[];
  reviews: PublicReviewSourceRecord[];
};

function toPublicKeyResult(keyResult: PublicKeyResultSourceRecord): PublicOkrKeyResultRecord {
  return {
    id: keyResult.id,
    titleZh: keyResult.titleZh,
    titleEn: keyResult.titleEn,
    descriptionZh: keyResult.descriptionZh,
    descriptionEn: keyResult.descriptionEn,
    mode: keyResult.progressMode === "MANUAL" ? "MANUAL" : "METRIC",
    startValue: keyResult.startValue,
    currentValue: keyResult.currentValue,
    targetValue: keyResult.targetValue,
    manualProgress: keyResult.manualProgress,
    unit: keyResult.unit,
    weight: keyResult.weight,
    status: keyResult.status,
  };
}

function toPublicObjective(objective: PublicObjectiveSourceRecord): PublicOkrObjectiveRecord {
  return {
    id: objective.id,
    titleZh: objective.titleZh,
    titleEn: objective.titleEn,
    descriptionZh: objective.descriptionZh,
    descriptionEn: objective.descriptionEn,
    status: objective.status,
    visibility: "PUBLIC",
    sortOrder: objective.sortOrder,
    keyResults: objective.keyResults.map(toPublicKeyResult),
  };
}

function toPublicReview(review: PublicReviewSourceRecord): PublicOkrReviewRecord {
  return {
    id: review.id,
    achievementsZh: review.achievementsZh,
    achievementsEn: review.achievementsEn,
    problemsZh: review.problemsZh,
    problemsEn: review.problemsEn,
    lessonsZh: review.lessonsZh,
    lessonsEn: review.lessonsEn,
    nextActionsZh: review.nextActionsZh,
    nextActionsEn: review.nextActionsEn,
    score: review.score,
    visibility: "PUBLIC",
    reviewedAt: review.reviewedAt.toISOString(),
  };
}

function toPublicCycle(cycle: PublicCycleSourceRecord): PublicOkrCycleRecord {
  return {
    id: cycle.id,
    nameZh: cycle.nameZh,
    nameEn: cycle.nameEn,
    type: cycle.type,
    status: cycle.status,
    visibility: "PUBLIC",
    startDate: cycle.startDate.toISOString(),
    endDate: cycle.endDate.toISOString(),
    objectives: cycle.objectives
      .filter((objective) => getObjectivePublicIssues(objective, cycle).length === 0)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(toPublicObjective),
    reviews: cycle.reviews
      .filter((review) => getReviewPublicIssues(review, cycle).length === 0)
      .map(toPublicReview),
  };
}

export function createPublicDataService(source: PublicDataSource) {
  return {
    async getPublishedSiteContent(): Promise<SiteContent | null> {
      const version = await source.findPublishedSiteVersion();
      return version ? siteContentSchema.parse(version.content) : null;
    },
    async getPublicOkrData(): Promise<PublicOkrCycleRecord[]> {
      const cycles = await source.findOkrCycles();
      return cycles
        .filter((cycle) => getCyclePublicIssues(cycle).length === 0)
        .map(toPublicCycle);
    },
  };
}

async function defaultSource(): Promise<PublicDataSource> {
  const database = await getDatabase();
  return {
    findPublishedSiteVersion: () => database.siteVersion.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, select: { content: true } }),
    findOkrCycles: async () => database.okrCycle.findMany({
      where: { visibility: "PUBLIC" },
      orderBy: { startDate: "desc" },
      include: {
        objectives: { where: { visibility: "PUBLIC" }, orderBy: { sortOrder: "asc" }, include: { keyResults: { orderBy: { sortOrder: "asc" } } } },
        reviews: { where: { visibility: "PUBLIC" }, orderBy: { reviewedAt: "desc" } },
      },
    }),
  };
}

export async function getPublishedSiteContent() {
  return createPublicDataService(await defaultSource()).getPublishedSiteContent();
}

export async function getPublicOkrData() {
  return createPublicDataService(await defaultSource()).getPublicOkrData();
}

export async function getPublicOkrRecords(): Promise<PublicOkrCycleRecord[]> {
  return getPublicOkrData();
}
