import { Prisma, type PrismaClient } from "@prisma/client";

import { fallbackSiteContent } from "../../components/public/data";
import { siteContentSchema, type SiteContent } from "../content/schema";
import { getDatabase } from "../db";

export type SiteVersionRecord = {
  id: string;
  version: number;
  status: string;
  content: unknown;
  publishedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type TransactionRepository = {
  findVersion(id: string): Promise<SiteVersionRecord | null>;
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
};

function prismaTransactionRepository(transaction: Prisma.TransactionClient): TransactionRepository {
  return {
    findVersion: (id) => transaction.siteVersion.findUnique({ where: { id } }),
    archivePublished: () => transaction.siteVersion.updateMany({ where: { status: "PUBLISHED" }, data: { status: "ARCHIVED" } }),
    publishVersion: (id, publishedAt) => transaction.siteVersion.update({ where: { id }, data: { status: "PUBLISHED", publishedAt } }),
    async latestVersionNumber() {
      return (await transaction.siteVersion.aggregate({ _max: { version: true } }))._max.version ?? 0;
    },
    createVersion: ({ content, ...data }) => transaction.siteVersion.create({ data: { ...data, content: content as Prisma.InputJsonValue } }),
  };
}

function createPrismaRepository(database: PrismaClient): SiteContentRepository {
  return {
    transaction: (run) => database.$transaction((transaction) => run(prismaTransactionRepository(transaction))),
    listVersions: () => database.siteVersion.findMany({ orderBy: { version: "desc" } }),
    findPublished: () => database.siteVersion.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } }),
    findDraft: () => database.siteVersion.findFirst({ where: { status: "DRAFT" }, orderBy: { version: "desc" } }),
    updateDraft: (id, content) => database.siteVersion.update({ where: { id }, data: { content: content as Prisma.InputJsonValue } }),
  };
}

export function createSiteContentService(repository: SiteContentRepository) {
  return {
    listVersions: () => repository.listVersions(),
    async getPublished(): Promise<SiteContent> {
      const version = await repository.findPublished();
      return version ? siteContentSchema.parse(version.content) : fallbackSiteContent;
    },
    async getOrCreateDraft(createdById?: string | null) {
      const existing = await repository.findDraft();
      if (existing) return { ...existing, content: siteContentSchema.parse(existing.content) };
      return repository.transaction(async (transaction) => {
        const published = await repository.findPublished();
        return transaction.createVersion({
          version: (await transaction.latestVersionNumber()) + 1,
          status: "DRAFT",
          content: published ? siteContentSchema.parse(published.content) : fallbackSiteContent,
          createdById,
        });
      });
    },
    async getVersion(id: string) {
      return repository.transaction(async (transaction) => {
        const version = await transaction.findVersion(id);
        if (!version) throw new Error("内容版本不存在");
        return { ...version, content: siteContentSchema.parse(version.content) };
      });
    },
    async saveDraft(id: string, input: unknown) {
      const content = siteContentSchema.parse(input);
      const versions = await repository.listVersions();
      const draft = versions.find((version) => version.id === id && version.status === "DRAFT");
      if (!draft) throw new Error("仅草稿版本可以保存");
      return repository.updateDraft(id, content);
    },
    async publish(id: string) {
      return repository.transaction(async (transaction) => {
        const target = await transaction.findVersion(id);
        if (!target || target.status !== "DRAFT") throw new Error("仅草稿版本可以发布");
        siteContentSchema.parse(target.content);
        await transaction.archivePublished();
        return transaction.publishVersion(id, new Date());
      });
    },
    async rollback(sourceId: string, createdById?: string | null) {
      return repository.transaction(async (transaction) => {
        const source = await transaction.findVersion(sourceId);
        if (!source) throw new Error("内容版本不存在");
        const content = siteContentSchema.parse(source.content);
        await transaction.archivePublished();
        return transaction.createVersion({
          version: (await transaction.latestVersionNumber()) + 1,
          status: "PUBLISHED",
          content,
          publishedAt: new Date(),
          createdById,
        });
      });
    },
  };
}

export async function getSiteContentService() {
  return createSiteContentService(createPrismaRepository(await getDatabase()));
}
