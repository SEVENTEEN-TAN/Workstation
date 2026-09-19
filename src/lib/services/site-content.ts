import type { Prisma, PrismaClient } from "@prisma/client";

import { siteContentSchema, type SiteContent } from "../content/schema";
import { materializeHomepageProjects } from "../content/homepage-projects";
import { getDatabase } from "../db";
import { parsePortfolioProjectRecord, type PortfolioProjectRecord } from "./portfolio-projects";

export type SiteVersionRecord = {
  id: string;
  version: number;
  status: string;
  content: unknown;
  publishedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SiteVersionData = {
  id: string;
  version: number;
  status: string;
  content: SiteContent;
  publishedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type TransactionRepository = {
  findVersion(id: string): Promise<SiteVersionRecord | null>;
  findDraft(): Promise<SiteVersionRecord | null>;
  updateDraft(id: string, content: SiteContent): Promise<SiteVersionRecord>;
  archivePublished(): Promise<unknown>;
  publishVersion(id: string, publishedAt: Date): Promise<SiteVersionRecord>;
  latestVersionNumber(): Promise<number>;
  createVersion(input: { version: number; status: string; content: SiteContent; publishedAt?: Date | null; createdById?: string | null }): Promise<SiteVersionRecord>;
};

export type SiteContentRepository = {
  transaction<T>(run: (repository: TransactionRepository) => Promise<T>): Promise<T>;
  listVersions(): Promise<SiteVersionRecord[]>;
  findPublished(): Promise<SiteVersionRecord | null>;
  findDraft(): Promise<SiteVersionRecord | null>;
  updateDraft(id: string, content: SiteContent): Promise<SiteVersionRecord>;
  findProjectsByIds(ids: string[]): Promise<PortfolioProjectRecord[]>;
};

function toSiteVersionData(record: SiteVersionRecord): SiteVersionData {
  return {
    id: record.id,
    version: record.version,
    status: record.status,
    content: siteContentSchema.parse(record.content),
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdAt: record.createdAt?.toISOString(),
    updatedAt: record.updatedAt?.toISOString(),
  };
}

function prismaTransactionRepository(transaction: Prisma.TransactionClient): TransactionRepository {
  return {
    findVersion: (id) => transaction.siteVersion.findUnique({ where: { id } }),
    findDraft: () => transaction.siteVersion.findFirst({ where: { status: "DRAFT" }, orderBy: { version: "desc" } }),
    updateDraft: (id, content) => transaction.siteVersion.update({ where: { id }, data: { content } }),
    archivePublished: () => transaction.siteVersion.updateMany({ where: { status: "PUBLISHED" }, data: { status: "ARCHIVED" } }),
    publishVersion: (id, publishedAt) => transaction.siteVersion.update({ where: { id }, data: { status: "PUBLISHED", publishedAt } }),
    async latestVersionNumber() {
      return (await transaction.siteVersion.aggregate({ _max: { version: true } }))._max.version ?? 0;
    },
    createVersion: ({ content, ...data }) => transaction.siteVersion.create({ data: { ...data, content } }),
  };
}

function createPrismaRepository(database: PrismaClient): SiteContentRepository {
  return {
    transaction: (run) => database.$transaction((transaction) => run(prismaTransactionRepository(transaction))),
    listVersions: () => database.siteVersion.findMany({ orderBy: { version: "desc" } }),
    findPublished: () => database.siteVersion.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } }),
    findDraft: () => database.siteVersion.findFirst({ where: { status: "DRAFT" }, orderBy: { version: "desc" } }),
    updateDraft: (id, content) => database.siteVersion.update({ where: { id }, data: { content } }),
    async findProjectsByIds(ids: string[]) {
      if (!ids.length) return [];
      const records = await database.portfolioProject.findMany({ where: { id: { in: ids } } });
      return records.map(parsePortfolioProjectRecord);
    },
  };
}

export function createSiteContentService(repository: SiteContentRepository) {
  return {
    async listVersions(): Promise<SiteVersionData[]> {
      return (await repository.listVersions()).map(toSiteVersionData);
    },
    async getPublished(): Promise<SiteContent | null> {
      const version = await repository.findPublished();
      return version ? siteContentSchema.parse(version.content) : null;
    },
    async getOrCreateDraft(createdById?: string | null) {
      const existing = await repository.findDraft();
      if (existing) return toSiteVersionData(existing);
      const published = await repository.findPublished();
      if (!published) throw new Error("站点尚未初始化，请先运行数据库种子");
      const content = siteContentSchema.parse(published.content);
      return repository.transaction(async (transaction) => {
        return toSiteVersionData(await transaction.createVersion({
          version: (await transaction.latestVersionNumber()) + 1,
          status: "DRAFT",
          content,
          createdById,
        }));
      });
    },
    async getVersion(id: string) {
      return repository.transaction(async (transaction) => {
        const version = await transaction.findVersion(id);
        if (!version) throw new Error("内容版本不存在");
        return toSiteVersionData(version);
      });
    },
    async saveDraft(id: string, input: unknown) {
      const content = siteContentSchema.parse(input);
      const versions = await repository.listVersions();
      const draft = versions.find((version) => version.id === id && version.status === "DRAFT");
      if (!draft) throw new Error("仅草稿版本可以保存");
      const selectedProjectIds = content.selectedProjectIds;
      const materializedContent = selectedProjectIds
        ? materializeHomepageProjects(content, await repository.findProjectsByIds(selectedProjectIds))
        : content;
      return repository.updateDraft(id, materializedContent).then(toSiteVersionData);
    },
    async publish(id: string) {
      return repository.transaction(async (transaction) => {
        const target = await transaction.findVersion(id);
        if (!target || target.status !== "DRAFT") throw new Error("仅草稿版本可以发布");
        siteContentSchema.parse(target.content);
        await transaction.archivePublished();
        return toSiteVersionData(await transaction.publishVersion(id, new Date()));
      });
    },
    async rollback(sourceId: string, createdById?: string | null) {
      return repository.transaction(async (transaction) => {
        const source = await transaction.findVersion(sourceId);
        if (!source) throw new Error("内容版本不存在");
        const content = siteContentSchema.parse(source.content);
        const draft = await transaction.findDraft();
        if (draft) return transaction.updateDraft(draft.id, content).then(toSiteVersionData);
        return toSiteVersionData(await transaction.createVersion({
          version: (await transaction.latestVersionNumber()) + 1,
          status: "DRAFT",
          content,
          publishedAt: null,
          createdById,
        }));
      });
    },
  };
}

export async function getSiteContentService() {
  return createSiteContentService(createPrismaRepository(await getDatabase()));
}
