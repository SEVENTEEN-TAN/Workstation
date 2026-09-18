import type { Prisma } from "@prisma/client";

import { getDatabase } from "../db";
import { weeklyDraftPatchSchema, weeklyRangeSchema } from "../validators/weekly-activity-drafts";

export type WeeklySourceSnapshot = {
  github: { id: string; type: string; repository: string; url: string | null; occurredAt: Date }[];
  progress: { id: string; titleZh: string; titleEn: string | null; progress: number; noteZh: string | null; noteEn: string | null; recordedAt: Date }[];
  actions: { id: string; titleZh: string; titleEn: string | null; completedAt: Date }[];
  projects: { id: string; titleZh: string; titleEn: string | null; summaryZh: string; summaryEn: string | null; updatedAt: Date }[];
  articles: { id: string; title: string; summary: string | null; publishedAt: Date }[];
  activities: { id: string; titleZh: string; titleEn: string | null; summaryZh: string; summaryEn: string | null; occurredAt: Date }[];
};

type WeeklyDraftWrite = {
  weekStart: Date;
  weekEnd: Date;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  sourceSnapshot: WeeklySourceSnapshot;
  generatedAt: Date;
};

type EditableDraft = {
  id: string;
  status: string;
  titleZh?: string;
  titleEn?: string | null;
  summaryZh?: string;
  summaryEn?: string | null;
  weekEnd?: Date;
  convertedActivityId?: string | null;
};

export type WeeklyActivityDraftRepository = {
  listDrafts(): Promise<unknown[]>;
  findDraftByWeekStart(weekStart: Date): Promise<EditableDraft | null>;
  selectedRepositories(): Promise<string[]>;
  weeklySources(start: Date, endExclusive: Date, repositories: string[]): Promise<WeeklySourceSnapshot>;
  upsertDraft(value: WeeklyDraftWrite): Promise<unknown>;
  findDraft(id: string): Promise<EditableDraft | null>;
  updateDraft(id: string, value: Record<string, unknown>): Promise<unknown>;
  convertDraft(id: string, activity: Record<string, unknown>): Promise<unknown>;
};

const DAY = 86_400_000;

function chinaDate(value: string) {
  const date = new Date(`${value}T00:00:00.000+08:00`);
  if (Number.isNaN(date.getTime())) throw new Error("日期无效");
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Shanghai",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  if (`${parts.year}-${parts.month}-${parts.day}` !== value) throw new Error("日期无效");
  return date;
}

export function normalizeWeeklyRange(input: unknown) {
  const value = weeklyRangeSchema.parse(input);
  const weekStart = chinaDate(value.weekStart);
  const weekEnd = chinaDate(value.weekEnd);
  const days = Math.round((weekEnd.getTime() - weekStart.getTime()) / DAY) + 1;
  if (days < 1 || days > 7) throw new Error("周报区间必须为 1 至 7 天");
  return { weekStart, weekEnd, endExclusive: new Date(weekEnd.getTime() + DAY) };
}

function englishRange(start: Date, end: Date) {
  const parts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Shanghai",
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const left = parts(start);
  const right = parts(end);
  if (left.year === right.year && left.month === right.month) return `${left.month} ${left.day}–${right.day}, ${right.year}`;
  if (left.year === right.year) return `${left.month} ${left.day}–${right.month} ${right.day}, ${right.year}`;
  return `${left.month} ${left.day}, ${left.year}–${right.month} ${right.day}, ${right.year}`;
}

function sourceCopy(sources: WeeklySourceSnapshot) {
  const zh: string[] = [];
  const en: string[] = [];
  if (sources.github.length) {
    zh.push(`GitHub：${sources.github.length} 条贡献事件`);
    en.push(`GitHub: ${sources.github.length} contribution event${sources.github.length === 1 ? "" : "s"}`);
  }
  if (sources.progress.length || sources.actions.length) {
    zh.push(`OKR：${sources.progress.length} 次进度更新，${sources.actions.length} 个执行项完成`);
    en.push(`OKR: ${sources.progress.length} progress update${sources.progress.length === 1 ? "" : "s"}, ${sources.actions.length} action item${sources.actions.length === 1 ? "" : "s"} completed`);
  }
  if (sources.projects.length) {
    zh.push(`项目：${sources.projects.map((item) => item.titleZh).join("、")}`);
    en.push(`Projects: ${sources.projects.map((item) => item.titleEn || item.titleZh).join(", ")}`);
  }
  if (sources.articles.length) {
    zh.push(`文章：${sources.articles.map((item) => item.title).join("、")}`);
    en.push(`Articles: ${sources.articles.map((item) => item.title).join(", ")}`);
  }
  if (sources.activities.length) {
    zh.push(`动态：${sources.activities.map((item) => item.titleZh).join("、")}`);
    en.push(`Activities: ${sources.activities.map((item) => item.titleEn || item.titleZh).join(", ")}`);
  }
  return {
    summaryZh: zh.length ? zh.join("\n") : "本周暂无自动聚合记录，可手动补充。",
    summaryEn: en.length ? en.join("\n") : "No activity was collected automatically this week. Add notes manually.",
  };
}

function defaultRepository(): WeeklyActivityDraftRepository {
  return {
    async listDrafts() {
      return (await getDatabase()).weeklyActivityDraft.findMany({ orderBy: { weekStart: "desc" } });
    },
    async findDraftByWeekStart(weekStart) {
      return (await getDatabase()).weeklyActivityDraft.findUnique({ where: { weekStart } });
    },
    async selectedRepositories() {
      const repositories = await (await getDatabase()).gitHubRepositorySnapshot.findMany({
        where: { selected: true }, select: { fullName: true },
      });
      return repositories.map((repository) => repository.fullName);
    },
    async weeklySources(start, endExclusive, repositories) {
      const database = await getDatabase();
      const [github, progress, actions, projects, articles, activities] = await Promise.all([
        repositories.length ? database.gitHubContributionEvent.findMany({
          where: { repository: { in: repositories }, occurredAt: { gte: start, lt: endExclusive } }, orderBy: { occurredAt: "desc" },
        }) : [],
        database.krProgressUpdate.findMany({
          where: { recordedAt: { gte: start, lt: endExclusive } }, orderBy: { recordedAt: "desc" },
          include: { keyResult: { select: { titleZh: true, titleEn: true } } },
        }),
        database.actionItem.findMany({
          where: { completedAt: { gte: start, lt: endExclusive } }, orderBy: { completedAt: "desc" },
          select: { id: true, titleZh: true, titleEn: true, completedAt: true },
        }),
        database.portfolioProject.findMany({
          where: { OR: [{ createdAt: { gte: start, lt: endExclusive } }, { updatedAt: { gte: start, lt: endExclusive } }] },
          orderBy: { updatedAt: "desc" }, select: { id: true, titleZh: true, titleEn: true, summaryZh: true, summaryEn: true, updatedAt: true },
        }),
        database.knowledgeArticle.findMany({
          where: { publishedAt: { gte: start, lt: endExclusive } }, orderBy: { publishedAt: "desc" },
          select: { id: true, title: true, summary: true, publishedAt: true },
        }),
        database.careerActivity.findMany({
          where: { occurredAt: { gte: start, lt: endExclusive }, weeklyDrafts: { none: {} } }, orderBy: { occurredAt: "desc" },
          select: { id: true, titleZh: true, titleEn: true, summaryZh: true, summaryEn: true, occurredAt: true },
        }),
      ]);
      return {
        github,
        progress: progress.map((item) => ({
          id: item.id, titleZh: item.keyResult.titleZh, titleEn: item.keyResult.titleEn,
          progress: item.calculatedProgress, noteZh: item.noteZh, noteEn: item.noteEn, recordedAt: item.recordedAt,
        })),
        actions: actions.map((item) => ({ ...item, completedAt: item.completedAt! })),
        projects, articles, activities,
      };
    },
    async upsertDraft(value) {
      const data = { ...value, sourceSnapshot: JSON.parse(JSON.stringify(value.sourceSnapshot)) as Prisma.InputJsonValue };
      const database = await getDatabase();
      return database.$transaction(async (transaction) => {
        const existing = await transaction.weeklyActivityDraft.findUnique({ where: { weekStart: value.weekStart } });
        if (existing?.status === "CONVERTED") throw new Error("已转换的周报不能重新生成");
        return transaction.weeklyActivityDraft.upsert({
          where: { weekStart: value.weekStart },
          create: { ...data, status: "DRAFT" },
          update: data,
        });
      });
    },
    async findDraft(id) {
      return (await getDatabase()).weeklyActivityDraft.findUnique({ where: { id } });
    },
    async updateDraft(id, value) {
      return (await getDatabase()).weeklyActivityDraft.update({ where: { id }, data: value });
    },
    async convertDraft(id, activity) {
      const database = await getDatabase();
      return database.$transaction(async (transaction) => {
        const draft = await transaction.weeklyActivityDraft.findUnique({ where: { id } });
        if (!draft) throw new Error("周报草稿不存在");
        if (draft.status !== "DRAFT") throw new Error("周报草稿已经转换");
        const created = await transaction.careerActivity.create({ data: activity as Prisma.CareerActivityCreateInput });
        return transaction.weeklyActivityDraft.update({
          where: { id }, data: { status: "CONVERTED", convertedActivityId: created.id },
        });
      });
    },
  };
}

export function createWeeklyActivityDraftService(repository: WeeklyActivityDraftRepository = defaultRepository()) {
  return {
    list: () => repository.listDrafts(),
    async generate(input: unknown) {
      const parsed = weeklyRangeSchema.parse(input);
      const range = normalizeWeeklyRange(parsed);
      const existing = await repository.findDraftByWeekStart(range.weekStart);
      if (existing?.status === "CONVERTED") throw new Error("已转换的周报不能重新生成");
      const repositories = await repository.selectedRepositories();
      const sources = await repository.weeklySources(range.weekStart, range.endExclusive, repositories);
      const copy = sourceCopy(sources);
      return repository.upsertDraft({
        weekStart: range.weekStart,
        weekEnd: range.weekEnd,
        titleZh: `${parsed.weekStart} 至 ${parsed.weekEnd} 周动态`,
        titleEn: `Weekly update · ${englishRange(range.weekStart, range.weekEnd)}`,
        ...copy,
        sourceSnapshot: sources,
        generatedAt: new Date(),
      });
    },
    async update(id: string, input: unknown) {
      const draft = await repository.findDraft(id);
      if (!draft) throw new Error("周报草稿不存在");
      if (draft.status !== "DRAFT") throw new Error("已转换的周报不能继续编辑");
      return repository.updateDraft(id, weeklyDraftPatchSchema.parse(input));
    },
    async convert(id: string) {
      const draft = await repository.findDraft(id);
      if (!draft) throw new Error("周报草稿不存在");
      if (draft.status !== "DRAFT") throw new Error("周报草稿已经转换");
      if (!draft.titleZh || !draft.summaryZh || !draft.weekEnd) throw new Error("周报草稿内容不完整");
      return repository.convertDraft(id, {
        titleZh: draft.titleZh,
        titleEn: draft.titleEn ?? null,
        summaryZh: draft.summaryZh,
        summaryEn: draft.summaryEn ?? null,
        occurredAt: draft.weekEnd,
        visibility: "PRIVATE",
        featured: false,
        linkUrl: null,
      });
    },
  };
}

export const weeklyActivityDraftService = createWeeklyActivityDraftService();
