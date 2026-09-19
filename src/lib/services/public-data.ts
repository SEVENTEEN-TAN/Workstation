import { siteContentSchema, type SiteContent } from "../content/schema";
import { getDatabase } from "../db";
import type { PublicOkrCycleRecord } from "../../components/public/data";

type PublicDataSource = {
  findPublishedSiteVersion(): Promise<{ content: unknown } | null>;
  findOkrCycles(): Promise<PublicCycleSourceRecord[]>;
};

type PublicReviewSourceRecord = {
  id: string;
  visibility: string;
  achievementsZh: unknown;
  achievementsEn?: unknown;
  problemsZh: unknown;
  problemsEn?: unknown;
  lessonsZh: unknown;
  lessonsEn?: unknown;
  nextActionsZh: unknown;
  nextActionsEn?: unknown;
  score?: unknown;
  reviewedAt: unknown;
};
type PublicObjectiveSourceRecord = {
  id: string;
  visibility: string;
  sortOrder: number;
  titleZh: unknown;
  titleEn?: unknown;
  descriptionZh?: unknown;
  descriptionEn?: unknown;
  status: unknown;
  keyResults: unknown[];
};
type PublicCycleSourceRecord = {
  id: string;
  visibility: string;
  nameZh: unknown;
  nameEn?: unknown;
  type?: unknown;
  status: unknown;
  startDate: unknown;
  endDate: unknown;
  objectives: PublicObjectiveSourceRecord[];
  reviews: PublicReviewSourceRecord[];
};

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasPairedText(zh: unknown, en: unknown) {
  return (!hasText(zh) && !hasText(en)) || (hasText(zh) && hasText(en));
}

function hasCompleteKeyResultEvidence(keyResults: unknown[]) {
  return keyResults.every((entry) => {
    const keyResult = entry as Record<string, unknown>;
    return hasText(keyResult.titleEn) && hasPairedText(keyResult.descriptionZh, keyResult.descriptionEn);
  });
}

function hasCompleteObjectiveEvidence(objective: PublicObjectiveSourceRecord) {
  return hasText(objective.titleEn)
    && hasPairedText(objective.descriptionZh, objective.descriptionEn)
    && hasCompleteKeyResultEvidence(objective.keyResults);
}

function hasCompleteReviewEvidence(review: PublicReviewSourceRecord) {
  return hasText(review.achievementsEn)
    && hasText(review.problemsEn)
    && hasText(review.lessonsEn)
    && hasText(review.nextActionsEn);
}

export function createPublicDataService(source: PublicDataSource) {
  return {
    async getPublishedSiteContent(): Promise<SiteContent | null> {
      const version = await source.findPublishedSiteVersion();
      return version ? siteContentSchema.parse(version.content) : null;
    },
    async getPublicOkrData() {
      const cycles = await source.findOkrCycles();
      return cycles
        .filter((cycle) => cycle.visibility === "PUBLIC" && hasText(cycle.nameEn))
        .map((cycle) => ({
          ...cycle,
          objectives: cycle.objectives
            .filter((objective) => objective.visibility === "PUBLIC" && hasCompleteObjectiveEvidence(objective))
            .sort((left, right) => left.sortOrder - right.sortOrder),
          reviews: cycle.reviews.filter((review) => review.visibility === "PUBLIC" && hasCompleteReviewEvidence(review)),
        }));
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
  const cycles = await getPublicOkrData();
  return cycles.map((cycle) => ({
    id: String(cycle.id),
    nameZh: String(cycle.nameZh),
    nameEn: cycle.nameEn == null ? null : String(cycle.nameEn),
    type: cycle.type == null ? undefined : String(cycle.type),
    status: String(cycle.status),
    visibility: "PUBLIC",
    startDate: new Date(String(cycle.startDate)).toISOString(),
    endDate: new Date(String(cycle.endDate)).toISOString(),
    objectives: cycle.objectives.map((objective) => ({
      id: String(objective.id),
      titleZh: String(objective.titleZh),
      titleEn: objective.titleEn == null ? null : String(objective.titleEn),
      descriptionZh: objective.descriptionZh == null ? null : String(objective.descriptionZh),
      descriptionEn: objective.descriptionEn == null ? null : String(objective.descriptionEn),
      status: String(objective.status),
      visibility: "PUBLIC",
      sortOrder: Number(objective.sortOrder),
      keyResults: (objective.keyResults as Array<Record<string, unknown>>).map((keyResult) => ({
        id: String(keyResult.id),
        titleZh: String(keyResult.titleZh),
        titleEn: keyResult.titleEn == null ? null : String(keyResult.titleEn),
        descriptionZh: keyResult.descriptionZh == null ? null : String(keyResult.descriptionZh),
        descriptionEn: keyResult.descriptionEn == null ? null : String(keyResult.descriptionEn),
        mode: keyResult.progressMode === "MANUAL" ? "MANUAL" : "METRIC",
        startValue: keyResult.startValue == null ? null : Number(keyResult.startValue),
        currentValue: keyResult.currentValue == null ? null : Number(keyResult.currentValue),
        targetValue: keyResult.targetValue == null ? null : Number(keyResult.targetValue),
        manualProgress: keyResult.manualProgress == null ? null : Number(keyResult.manualProgress),
        unit: keyResult.unit == null ? null : String(keyResult.unit),
        weight: keyResult.weight == null ? 1 : Number(keyResult.weight),
        status: String(keyResult.status),
      })),
    })),
    reviews: cycle.reviews.map((review) => ({
      id: String(review.id),
      achievementsZh: String(review.achievementsZh),
      achievementsEn: review.achievementsEn == null ? null : String(review.achievementsEn),
      problemsZh: String(review.problemsZh),
      problemsEn: review.problemsEn == null ? null : String(review.problemsEn),
      lessonsZh: String(review.lessonsZh),
      lessonsEn: review.lessonsEn == null ? null : String(review.lessonsEn),
      nextActionsZh: String(review.nextActionsZh),
      nextActionsEn: review.nextActionsEn == null ? null : String(review.nextActionsEn),
      score: review.score == null ? null : Number(review.score),
      visibility: "PUBLIC",
      reviewedAt: new Date(String(review.reviewedAt)).toISOString(),
    })),
  }));
}
