import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { getDatabase } from "../db";
import { createArticleAttachmentSnapshotter, type ArticleAttachmentSnapshot, type DraftAttachmentSource } from "../knowledge/article-attachment-snapshots";
import { isArticleImageEmbedTarget, rewriteArticleEmbeds, validateArticleEmbedMappings } from "../knowledge/article-attachments";

type DraftRecord = {
  id: string;
  sourceRevisionId: string;
  sourceHash: string;
  markdown: string;
  title: string;
  summary: string | null;
  tags: string[];
  attachments?: DraftAttachmentSource[];
  article?: {
    id: string;
    draftId: string;
    slug: string;
    publishedAt: Date;
  } | null;
};

type ArticleInput = Omit<DraftRecord, "id" | "attachments" | "article"> & { id: string; draftId: string; slug: string };

export type PublicKnowledgeArticle = {
  id: string;
  slug: string;
  markdown: string;
  title: string;
  summary: string | null;
  tags: string[];
  publishedAt: Date;
};

type KnowledgeArticleRepository = {
  findDraft(id: string): Promise<DraftRecord | null>;
  createArticle(input: ArticleInput, attachments: ArticleAttachmentSnapshot[]): Promise<{ created: boolean; article: unknown }>;
  listPublicArticles(): Promise<PublicKnowledgeArticle[]>;
  getPublicArticle(slug: string): Promise<PublicKnowledgeArticle | null>;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type AttachmentSnapshotter = {
  snapshot(articleId: string, attachments: DraftAttachmentSource[]): Promise<ArticleAttachmentSnapshot[]>;
  remove(attachments: ArticleAttachmentSnapshot[]): Promise<void>;
};

function embedTargets(markdown: string) {
  return [...markdown.matchAll(/!\[\[([^\]\r\n]+)\]\]/g)].map((match) => match[1].trim()).filter(Boolean);
}

function validatePublication(draft: DraftRecord, slug: string) {
  if (slug.length < 3 || slug.length > 96 || !slugPattern.test(slug)) {
    throw new Error("Article not ready");
  }
  try {
    const targets = embedTargets(draft.markdown);
    if (targets.some((target) => !isArticleImageEmbedTarget(target))) throw new Error("Unsupported embed");
    validateArticleEmbedMappings(targets, (draft.attachments ?? []).map((attachment) => ({ target: attachment.target, id: attachment.assetId })));
  } catch {
    throw new Error("Article not ready");
  }
}

function defaultRepository(): KnowledgeArticleRepository {
  return {
    async findDraft(id) {
      return (await getDatabase()).knowledgePublicationDraft.findUnique({
        where: { id },
        select: {
          id: true, sourceRevisionId: true, sourceHash: true, markdown: true, title: true, summary: true, tags: true,
          attachments: { select: { target: true, assetId: true, asset: { select: { storagePath: true, mimeType: true, sizeBytes: true, sha256: true } } } },
          article: { select: { id: true, draftId: true, slug: true, publishedAt: true } },
        },
      }) as Promise<DraftRecord | null>;
    },
    async createArticle(input, attachments) {
      const database = await getDatabase();
      try {
        return {
          created: true,
          article: await database.knowledgeArticle.create({
            data: { ...input, attachments: { create: attachments.map(({ id, target, storagePath, mimeType, sizeBytes, sha256 }) => ({ id, target, storagePath, mimeType, sizeBytes, sha256 })) } },
          }),
        };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const article = await database.knowledgeArticle.findUnique({ where: { draftId: input.draftId } });
          if (article) return { created: false, article };
        }
        throw error;
      }
    },
    async listPublicArticles() {
      return (await getDatabase()).knowledgeArticle.findMany({
        orderBy: { publishedAt: "desc" },
        select: { id: true, slug: true, markdown: true, title: true, summary: true, tags: true, publishedAt: true },
      }) as unknown as PublicKnowledgeArticle[];
    },
    async getPublicArticle(slug) {
      return (await getDatabase()).knowledgeArticle.findUnique({
        where: { slug },
        select: { id: true, slug: true, markdown: true, title: true, summary: true, tags: true, publishedAt: true },
      }) as unknown as PublicKnowledgeArticle | null;
    },
  };
}

export function createKnowledgeArticleService(
  repository: KnowledgeArticleRepository = defaultRepository(),
  snapshotter: AttachmentSnapshotter = createArticleAttachmentSnapshotter(),
) {
  return {
    async publishDraft(draftId: string, slug: string) {
      const draft = await repository.findDraft(draftId);
      if (!draft) throw new Error("Article not ready");
      if (draft.article) return draft.article;
      validatePublication(draft, slug);
      const articleId = randomUUID();
      let attachments: ArticleAttachmentSnapshot[] = [];
      try {
        if (draft.attachments?.length) attachments = await snapshotter.snapshot(articleId, draft.attachments);
        validateArticleEmbedMappings(embedTargets(draft.markdown), attachments);
        const snapshot = {
          sourceRevisionId: draft.sourceRevisionId,
          sourceHash: draft.sourceHash,
          title: draft.title,
          summary: draft.summary,
          tags: draft.tags,
        };
        const result = await repository.createArticle({
          ...snapshot,
          id: articleId,
          draftId: draft.id,
          slug,
          markdown: rewriteArticleEmbeds(draft.markdown, attachments),
        }, attachments);
        if (!result.created) await snapshotter.remove(attachments);
        return result.article;
      } catch (error) {
        await snapshotter.remove(attachments);
        throw error;
      }
    },
    listPublicArticles: () => repository.listPublicArticles(),
    getPublicArticle: (slug: string) => repository.getPublicArticle(slug),
  };
}

export const knowledgeArticleService = createKnowledgeArticleService();
