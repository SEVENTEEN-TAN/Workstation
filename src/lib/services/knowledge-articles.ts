import { getDatabase } from "../db";

type DraftRecord = {
  id: string;
  sourceRevisionId: string;
  sourceHash: string;
  markdown: string;
  title: string;
  summary: string | null;
  tags: string[];
};

type ArticleInput = Omit<DraftRecord, "id"> & { draftId: string; slug: string };

type KnowledgeArticleRepository = {
  findDraft(id: string): Promise<DraftRecord | null>;
  upsertArticle(input: ArticleInput): Promise<unknown>;
  listPublicArticles(): Promise<unknown>;
  getPublicArticle(slug: string): Promise<unknown>;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validatePublication(draft: DraftRecord, slug: string) {
  if (slug.length < 3 || slug.length > 96 || !slugPattern.test(slug) || /!\[\[[^\]]+\]\]/.test(draft.markdown)) {
    throw new Error("Article not ready");
  }
}

function defaultRepository(): KnowledgeArticleRepository {
  return {
    async findDraft(id) {
      return (await getDatabase()).knowledgePublicationDraft.findUnique({
        where: { id },
        select: { id: true, sourceRevisionId: true, sourceHash: true, markdown: true, title: true, summary: true, tags: true },
      }) as Promise<DraftRecord | null>;
    },
    async upsertArticle(input) {
      return (await getDatabase()).knowledgeArticle.upsert({
        where: { draftId: input.draftId },
        update: {},
        create: input,
      });
    },
    async listPublicArticles() {
      return (await getDatabase()).knowledgeArticle.findMany({ orderBy: { publishedAt: "desc" } });
    },
    async getPublicArticle(slug) {
      return (await getDatabase()).knowledgeArticle.findUnique({ where: { slug } });
    },
  };
}

export function createKnowledgeArticleService(repository: KnowledgeArticleRepository = defaultRepository()) {
  return {
    async publishDraft(draftId: string, slug: string) {
      const draft = await repository.findDraft(draftId);
      if (!draft) throw new Error("Article not ready");
      validatePublication(draft, slug);
      const { id, ...snapshot } = draft;
      return repository.upsertArticle({ ...snapshot, draftId: id, slug });
    },
    listPublicArticles: () => repository.listPublicArticles(),
    getPublicArticle: (slug: string) => repository.getPublicArticle(slug),
  };
}

export const knowledgeArticleService = createKnowledgeArticleService();
