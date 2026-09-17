import { basename, extname } from "node:path";

import { getDatabase } from "../db";

type SourceRevisionRecord = {
  id: string;
  relativePath: string;
  contentHash: string;
  markdown: string;
  frontmatterJson: string | null;
};

type DraftInput = {
  sourceRevisionId: string;
  sourceHash: string;
  markdown: string;
  title: string;
  summary: string | null;
  tags: string[];
  status: "DRAFT";
};

type KnowledgePublicationRepository = {
  findSourceRevision(id: string): Promise<SourceRevisionRecord | null>;
  upsertDraft(input: DraftInput): Promise<unknown>;
};

function sourceMetadata(revision: SourceRevisionRecord) {
  let frontmatter: Record<string, unknown> = {};
  try {
    const value: unknown = revision.frontmatterJson ? JSON.parse(revision.frontmatterJson) : {};
    if (value && typeof value === "object" && !Array.isArray(value)) frontmatter = value as Record<string, unknown>;
  } catch {
    // Invalid snapshots remain reviewable through the filename fallback.
  }
  const fallbackTitle = basename(revision.relativePath, extname(revision.relativePath));
  const title = typeof frontmatter.title === "string" && frontmatter.title.trim() ? frontmatter.title.trim() : fallbackTitle;
  const summaryValue = frontmatter.summary ?? frontmatter.excerpt;
  const summary = typeof summaryValue === "string" && summaryValue.trim() ? summaryValue.trim() : null;
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags.filter((tag): tag is string => typeof tag === "string") : [];
  return { title, summary, tags };
}

function defaultRepository(): KnowledgePublicationRepository {
  return {
    async findSourceRevision(id) {
      return (await getDatabase()).knowledgeSourceRevision.findUnique({
        where: { id },
        select: { id: true, relativePath: true, contentHash: true, markdown: true, frontmatterJson: true },
      });
    },
    async upsertDraft(input) {
      return (await getDatabase()).knowledgePublicationDraft.upsert({
        where: { sourceRevisionId: input.sourceRevisionId },
        update: {},
        create: input,
        include: { attachments: { select: { id: true, target: true, assetId: true } }, article: { select: { id: true, draftId: true, slug: true, publishedAt: true } } },
      });
    },
  };
}

export function createKnowledgePublicationService(repository: KnowledgePublicationRepository = defaultRepository()) {
  return {
    async createDraft(sourceRevisionId: string) {
      const revision = await repository.findSourceRevision(sourceRevisionId);
      if (!revision) throw new Error("Source revision unavailable");
      return repository.upsertDraft({
        sourceRevisionId: revision.id,
        sourceHash: revision.contentHash,
        markdown: revision.markdown,
        ...sourceMetadata(revision),
        status: "DRAFT",
      });
    },
  };
}

export const knowledgePublicationService = createKnowledgePublicationService();
