import type { Prisma } from "@prisma/client";

import { getDatabase } from "../db";
import { careerTimelineDraftPatchSchema } from "../validators/career-timeline-drafts";
import { parseJsonSnapshot } from "./json-snapshot";

type ArticleSource = { id: string; title: string; summary: string | null; publishedAt: Date };
type ProjectSource = { id: string; titleZh: string; titleEn: string | null; summaryZh: string; summaryEn: string | null; completedAt: Date | null };
type ActivitySource = { id: string; titleZh: string; titleEn: string | null; summaryZh: string; summaryEn: string | null; occurredAt: Date };
type MilestoneSource = { id: string; titleZh: string; titleEn: string; summaryZh: string; summaryEn: string; occurredAt: Date };

export type CareerTimelineSources = {
  articles: ArticleSource[];
  projects: ProjectSource[];
  activities: ActivitySource[];
  milestones: MilestoneSource[];
};

export type CareerTimelineDraftWrite = {
  sourceKey: string;
  kind: "ARTICLE" | "PROJECT_COMPLETED" | "ACTIVITY" | "OKR_MILESTONE";
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  occurredAt: Date;
  sourceSnapshot: Record<string, unknown>;
};

type EditableDraft = {
  id: string;
  status: string;
  titleZh?: string;
  titleEn?: string | null;
  summaryZh?: string;
  summaryEn?: string | null;
  occurredAt?: Date;
};

export type CareerTimelineDraftRepository = {
  listDrafts(): Promise<unknown[]>;
  timelineSources(): Promise<CareerTimelineSources>;
  createMissingDrafts(drafts: CareerTimelineDraftWrite[]): Promise<unknown>;
  findDraft(id: string): Promise<EditableDraft | null>;
  updateDraft(id: string, value: Record<string, unknown>): Promise<unknown>;
  convertDraft(id: string, activity: Prisma.CareerActivityCreateInput): Promise<unknown>;
};

export function buildCareerTimelineDrafts(sources: CareerTimelineSources): CareerTimelineDraftWrite[] {
  const articles = sources.articles.map((article) => ({
    sourceKey: `ARTICLE:${article.id}`,
    kind: "ARTICLE" as const,
    titleZh: `发布文章：${article.title}`,
    titleEn: `Article published: ${article.title}`,
    summaryZh: article.summary || `发布文章《${article.title}》。`,
    summaryEn: article.summary || `Published “${article.title}”.`,
    occurredAt: article.publishedAt,
    sourceSnapshot: article,
  }));
  const projects = sources.projects.flatMap((project) => project.completedAt ? [{
    sourceKey: `PROJECT_COMPLETED:${project.id}`,
    kind: "PROJECT_COMPLETED" as const,
    titleZh: `完成项目：${project.titleZh}`,
    titleEn: `Project completed: ${project.titleEn || project.titleZh}`,
    summaryZh: project.summaryZh,
    summaryEn: project.summaryEn || project.summaryZh,
    occurredAt: project.completedAt,
    sourceSnapshot: project,
  }] : []);
  const activities = sources.activities.map((activity) => ({
    sourceKey: `ACTIVITY:${activity.id}`,
    kind: "ACTIVITY" as const,
    titleZh: activity.titleZh,
    titleEn: activity.titleEn || activity.titleZh,
    summaryZh: activity.summaryZh,
    summaryEn: activity.summaryEn || activity.summaryZh,
    occurredAt: activity.occurredAt,
    sourceSnapshot: activity,
  }));
  const milestones = sources.milestones.map((milestone) => ({
    sourceKey: `OKR_MILESTONE:${milestone.id}`,
    kind: "OKR_MILESTONE" as const,
    titleZh: milestone.titleZh,
    titleEn: milestone.titleEn || milestone.titleZh,
    summaryZh: milestone.summaryZh,
    summaryEn: milestone.summaryEn || milestone.summaryZh,
    occurredAt: milestone.occurredAt,
    sourceSnapshot: milestone,
  }));
  return [...articles, ...projects, ...activities, ...milestones];
}

function defaultRepository(): CareerTimelineDraftRepository {
  return {
    async listDrafts() {
      return (await getDatabase()).careerTimelineDraft.findMany({ orderBy: { occurredAt: "desc" } });
    },
    async timelineSources() {
      const database = await getDatabase();
      const [articles, projects, activities, milestones] = await Promise.all([
        database.knowledgeArticle.findMany({ orderBy: { publishedAt: "desc" }, select: { id: true, title: true, summary: true, publishedAt: true } }),
        database.portfolioProject.findMany({ where: { completedAt: { not: null } }, orderBy: { completedAt: "desc" }, select: { id: true, titleZh: true, titleEn: true, summaryZh: true, summaryEn: true, completedAt: true } }),
        database.careerActivity.findMany({
          where: { weeklyDrafts: { none: {} }, okrMilestoneDrafts: { none: {} }, timelineDrafts: { none: {} } },
          orderBy: { occurredAt: "desc" },
          select: { id: true, titleZh: true, titleEn: true, summaryZh: true, summaryEn: true, occurredAt: true },
        }),
        database.okrMilestoneDraft.findMany({ orderBy: { occurredAt: "desc" }, select: { id: true, titleZh: true, titleEn: true, summaryZh: true, summaryEn: true, occurredAt: true } }),
      ]);
      return { articles, projects, activities, milestones };
    },
    async createMissingDrafts(drafts) {
      if (!drafts.length) return this.listDrafts();
      const database = await getDatabase();
      await database.$transaction(async (transaction) => {
        const existing = await transaction.careerTimelineDraft.findMany({
          where: { sourceKey: { in: drafts.map((draft) => draft.sourceKey) } },
          select: { sourceKey: true },
        });
        const keys = new Set(existing.map((draft) => draft.sourceKey));
        const missing = drafts.filter((draft) => !keys.has(draft.sourceKey)).map((draft) => ({
          ...draft,
          sourceSnapshot: parseJsonSnapshot(draft.sourceSnapshot),
        }));
        if (missing.length) await transaction.careerTimelineDraft.createMany({ data: missing });
      });
      return this.listDrafts();
    },
    async findDraft(id) {
      return (await getDatabase()).careerTimelineDraft.findUnique({ where: { id } });
    },
    async updateDraft(id, value) {
      const database = await getDatabase();
      return database.$transaction(async (transaction) => {
        const draft = await transaction.careerTimelineDraft.findUnique({ where: { id } });
        if (!draft) throw new Error("时间线草稿不存在");
        if (draft.status !== "DRAFT") throw new Error("已转换的时间线草稿不能继续编辑");
        return transaction.careerTimelineDraft.update({ where: { id }, data: value });
      });
    },
    async convertDraft(id, activity) {
      const database = await getDatabase();
      return database.$transaction(async (transaction) => {
        const draft = await transaction.careerTimelineDraft.findUnique({ where: { id } });
        if (!draft) throw new Error("时间线草稿不存在");
        if (draft.status !== "DRAFT") throw new Error("时间线草稿已经转换");
        const created = await transaction.careerActivity.create({ data: activity });
        return transaction.careerTimelineDraft.update({
          where: { id }, data: { status: "CONVERTED", convertedActivityId: created.id },
        });
      });
    },
  };
}

export function createCareerTimelineDraftService(repository: CareerTimelineDraftRepository = defaultRepository()) {
  return {
    list: () => repository.listDrafts(),
    async sync() {
      return repository.createMissingDrafts(buildCareerTimelineDrafts(await repository.timelineSources()));
    },
    async update(id: string, input: unknown) {
      const draft = await repository.findDraft(id);
      if (!draft) throw new Error("时间线草稿不存在");
      if (draft.status !== "DRAFT") throw new Error("已转换的时间线草稿不能继续编辑");
      return repository.updateDraft(id, careerTimelineDraftPatchSchema.parse(input));
    },
    async convert(id: string) {
      const draft = await repository.findDraft(id);
      if (!draft) throw new Error("时间线草稿不存在");
      if (draft.status !== "DRAFT") throw new Error("时间线草稿已经转换");
      if (!draft.titleZh || !draft.summaryZh || !draft.occurredAt) throw new Error("时间线草稿内容不完整");
      return repository.convertDraft(id, {
        titleZh: draft.titleZh,
        titleEn: draft.titleEn || null,
        summaryZh: draft.summaryZh,
        summaryEn: draft.summaryEn || null,
        occurredAt: draft.occurredAt,
        visibility: "PRIVATE",
        featured: false,
        linkUrl: null,
      });
    },
  };
}

export const careerTimelineDraftService = createCareerTimelineDraftService();
