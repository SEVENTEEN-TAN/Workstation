import { z } from "zod";

import { getDatabase } from "../db";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const articleIdsSchema = z.array(z.string().min(1).max(128)).max(200).refine((ids) => new Set(ids).size === ids.length, "文章不能重复");
const fieldsSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1_000).nullable().optional().transform((value) => value?.trim() || null),
  slug: z.string().trim().min(3).max(96).regex(slugPattern),
  visibility: z.enum(["PRIVATE", "PUBLIC"]).default("PRIVATE"),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});

export const knowledgeCollectionInputSchema = fieldsSchema.extend({ articleIds: articleIdsSchema });
const knowledgeCollectionPatchSchema = fieldsSchema.partial().extend({ articleIds: articleIdsSchema.optional() });

export type KnowledgeCollectionArticle = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  publishedAt: Date;
};

export type KnowledgeCollectionRecord = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  visibility: "PRIVATE" | "PUBLIC";
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
  articles: KnowledgeCollectionArticle[];
};

type KnowledgeCollectionInput = z.output<typeof knowledgeCollectionInputSchema>;

export type KnowledgeCollectionRepository = {
  listAdmin(): Promise<KnowledgeCollectionRecord[]>;
  listPublishedArticles(): Promise<KnowledgeCollectionArticle[]>;
  findAdmin(id: string): Promise<KnowledgeCollectionRecord | null>;
  create(value: KnowledgeCollectionInput): Promise<unknown>;
  update(id: string, value: KnowledgeCollectionInput): Promise<unknown>;
  remove(id: string): Promise<unknown>;
  listPublic(): Promise<KnowledgeCollectionRecord[]>;
  getPublic(slug: string): Promise<KnowledgeCollectionRecord | null>;
};

function collectionInclude() {
  return {
    articles: {
      orderBy: { sortOrder: "asc" as const },
      select: { article: { select: { id: true, slug: true, title: true, summary: true, tags: true, publishedAt: true } } },
    },
  };
}

function collectionData(value: KnowledgeCollectionInput) {
  return {
    title: value.title,
    description: value.description,
    slug: value.slug,
    visibility: value.visibility,
    sortOrder: value.sortOrder,
    articles: { create: value.articleIds.map((articleId, sortOrder) => ({ articleId, sortOrder })) },
  };
}

function toArticle(value: { id: string; slug: string; title: string; summary: string | null; tags: unknown; publishedAt: Date }): KnowledgeCollectionArticle {
  return { ...value, tags: Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string") : [] };
}

function toRecord(value: { id: string; title: string; description: string | null; slug: string; visibility: string; sortOrder: number; createdAt: Date; updatedAt: Date; articles: Array<{ article: { id: string; slug: string; title: string; summary: string | null; tags: unknown; publishedAt: Date } }> }): KnowledgeCollectionRecord {
  return { ...value, visibility: value.visibility as "PRIVATE" | "PUBLIC", articles: value.articles.map(({ article }) => toArticle(article)) };
}

function defaultRepository(): KnowledgeCollectionRepository {
  return {
    async listAdmin() {
      const collections = await (await getDatabase()).knowledgeCollection.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }], include: collectionInclude() });
      return collections.map(toRecord);
    },
    async listPublishedArticles() {
      const articles = await (await getDatabase()).knowledgeArticle.findMany({ orderBy: { publishedAt: "desc" }, select: { id: true, slug: true, title: true, summary: true, tags: true, publishedAt: true } });
      return articles.map(toArticle);
    },
    async findAdmin(id) {
      const collection = await (await getDatabase()).knowledgeCollection.findUnique({ where: { id }, include: collectionInclude() });
      return collection ? toRecord(collection) : null;
    },
    async create(value) {
      const collection = await (await getDatabase()).knowledgeCollection.create({ data: collectionData(value), include: collectionInclude() });
      return toRecord(collection);
    },
    async update(id, value) {
      const collection = await (await getDatabase()).knowledgeCollection.update({
        where: { id },
        data: { ...collectionData(value), articles: { deleteMany: {}, create: value.articleIds.map((articleId, sortOrder) => ({ articleId, sortOrder })) } },
        include: collectionInclude(),
      });
      return toRecord(collection);
    },
    remove(id) {
      return getDatabase().then((database) => database.knowledgeCollection.delete({ where: { id } }));
    },
    async listPublic() {
      const collections = await (await getDatabase()).knowledgeCollection.findMany({ where: { visibility: "PUBLIC", articles: { some: {} } }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }], include: collectionInclude() });
      return collections.map(toRecord);
    },
    async getPublic(slug) {
      const collection = await (await getDatabase()).knowledgeCollection.findFirst({ where: { slug, visibility: "PUBLIC" }, include: collectionInclude() });
      return collection ? toRecord(collection) : null;
    },
  };
}

async function assertPublishedArticles(source: KnowledgeCollectionRepository, articleIds: string[]) {
  if (!articleIds.length) return;
  const publishedIds = new Set((await source.listPublishedArticles()).map((article) => article.id));
  if (articleIds.some((id) => !publishedIds.has(id))) throw new Error("文章不存在或尚未发布");
}

export function createKnowledgeCollectionService(repository: KnowledgeCollectionRepository = defaultRepository()) {
  return {
    listAdmin: () => repository.listAdmin(),
    listPublishedArticles: () => repository.listPublishedArticles(),
    async create(input: unknown) {
      const value = knowledgeCollectionInputSchema.parse(input);
      await assertPublishedArticles(repository, value.articleIds);
      return repository.create(value);
    },
    async update(id: string, input: unknown) {
      const current = await repository.findAdmin(id);
      if (!current) throw new Error("知识合集不存在");
      const patch = knowledgeCollectionPatchSchema.parse(input);
      const value = knowledgeCollectionInputSchema.parse({ ...current, ...patch, articleIds: patch.articleIds ?? current.articles.map((article) => article.id) });
      await assertPublishedArticles(repository, value.articleIds);
      return repository.update(id, value);
    },
    async remove(id: string) {
      if (!await repository.findAdmin(id)) throw new Error("知识合集不存在");
      return repository.remove(id);
    },
    listPublic: () => repository.listPublic(),
    getPublic: (slug: string) => repository.getPublic(slug),
  };
}

export const knowledgeCollectionService = createKnowledgeCollectionService();
