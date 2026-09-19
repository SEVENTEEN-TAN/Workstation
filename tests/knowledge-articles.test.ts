import { describe, expect, it } from "vitest";

import { createKnowledgeArticleService } from "../src/lib/services/knowledge-articles";

const draft = {
  id: "draft-1",
  sourceRevisionId: "revision-1",
  sourceHash: "hash-1",
  markdown: "# Snapshot",
  title: "Snapshot title",
  summary: "Summary",
  tags: ["knowledge"],
};

describe("knowledge article service", () => {
  it("copies a draft into an immutable article with a validated slug", async () => {
    const service = createKnowledgeArticleService({
      async findDraft(id) { return id === draft.id ? draft : null; },
      async createArticle(input) { return { created: true, article: input }; },
      async findArticle() { return null; },
      async deleteArticle() { throw new Error("not used"); },
      async listPublicArticles() { return []; },
      async getPublicArticle() { return null; },
    });

    await expect(service.publishDraft("draft-1", "workstation-notes")).resolves.toMatchObject({
      draftId: "draft-1",
      slug: "workstation-notes",
      markdown: "# Snapshot",
      title: "Snapshot title",
    });
    await expect(service.publishDraft("draft-1", "Bad slug")).rejects.toThrow("Article not ready");
  });

  it("rejects drafts with unselected Obsidian attachment embeds", async () => {
    const service = createKnowledgeArticleService({
      async findDraft() { return { ...draft, markdown: "![[private.png]]" }; },
      async createArticle() { throw new Error("not used"); },
      async findArticle() { return null; },
      async deleteArticle() { throw new Error("not used"); },
      async listPublicArticles() { return []; },
      async getPublicArticle() { return null; },
    });

    await expect(service.publishDraft("draft-1", "with-attachment")).rejects.toThrow("Article not ready");
  });

  it("keeps non-image embeds blocked even if a legacy draft mapping exists", async () => {
    const service = createKnowledgeArticleService({
      async findDraft() { return { ...draft, markdown: "![[private-note.md]]", attachments: [{ target: "private-note.md", assetId: "asset-1" }] }; },
      async createArticle() { throw new Error("not used"); },
      async findArticle() { return null; },
      async deleteArticle() { throw new Error("not used"); },
      async listPublicArticles() { return []; },
      async getPublicArticle() { return null; },
    }, {
      async snapshot() { throw new Error("not used"); },
      async remove() {},
    });

    await expect(service.publishDraft("draft-1", "with-attachment")).rejects.toThrow("Article not ready");
  });

  it("publishes selected image embeds through immutable article snapshots", async () => {
    const saved: Array<Record<string, unknown>> = [];
    const service = createKnowledgeArticleService({
      async findDraft() { return { ...draft, markdown: "![[diagram.png]]", attachments: [{ target: "diagram.png", assetId: "asset-1" }] }; },
      async createArticle(input) { saved.push(input); return { created: true, article: input }; },
      async findArticle() { return null; },
      async deleteArticle() { throw new Error("not used"); },
      async listPublicArticles() { return []; },
      async getPublicArticle() { return null; },
    }, {
      async snapshot() { return [{ target: "diagram.png", id: "snapshot-1" }]; },
      async remove() {},
    });

    await expect(service.publishDraft("draft-1", "with-attachment")).resolves.toMatchObject({ slug: "with-attachment" });
    expect(saved[0].markdown).toBe("![](/api/knowledge/assets/snapshot-1)");
  });

  it("returns the existing immutable article without creating another snapshot", async () => {
    const existing = { id: "article-1", draftId: "draft-1", slug: "existing", publishedAt: new Date() };
    const service = createKnowledgeArticleService({
      async findDraft() { return { ...draft, article: existing }; },
      async createArticle() { throw new Error("not used"); },
      async findArticle() { return null; },
      async deleteArticle() { throw new Error("not used"); },
      async listPublicArticles() { return []; },
      async getPublicArticle() { return null; },
    }, {
      async snapshot() { throw new Error("not used"); },
      async remove() {},
    });

    await expect(service.publishDraft("draft-1", "another-slug")).resolves.toBe(existing);
  });

  it("removes a fresh snapshot when a concurrent publish already created the article", async () => {
    const removed: string[] = [];
    const existing = { id: "article-1", draftId: "draft-1", slug: "existing", publishedAt: new Date() };
    const service = createKnowledgeArticleService({
      async findDraft() { return { ...draft, markdown: "![[diagram.png]]", attachments: [{ target: "diagram.png", assetId: "asset-1" }] }; },
      async createArticle() { return { created: false, article: existing }; },
      async findArticle() { return null; },
      async deleteArticle() { throw new Error("not used"); },
      async listPublicArticles() { return []; },
      async getPublicArticle() { return null; },
    }, {
      async snapshot() { return [{ target: "diagram.png", id: "snapshot-1", storagePath: "C:/snapshots/snapshot-1", mimeType: "image/png", sizeBytes: 4, sha256: "hash" }]; },
      async remove(snapshots) { removed.push(...snapshots.map((snapshot) => snapshot.id)); },
    });

    await expect(service.publishDraft("draft-1", "with-attachment")).resolves.toBe(existing);
    expect(removed).toEqual(["snapshot-1"]);
  });

  it("unpublishes an article, cleans its snapshots, and keeps the source draft reusable", async () => {
    const events: string[] = [];
    const service = createKnowledgeArticleService({
      async findDraft() { return draft; },
      async createArticle() { throw new Error("not used"); },
      async listPublicArticles() { return []; },
      async getPublicArticle() { return null; },
      async findArticle(id) {
        return {
          id,
          slug: "published-article",
          attachments: [{ id: "snapshot-1", target: "diagram.png", storagePath: "C:/snapshots/snapshot-1", mimeType: "image/png", sizeBytes: 4, sha256: "hash" }],
        };
      },
      async deleteArticle(id) {
        events.push(`database:${id}`);
        return { id };
      },
    } as Parameters<typeof createKnowledgeArticleService>[0], {
      async snapshot() { throw new Error("not used"); },
      async remove(snapshots) {
        events.push(...snapshots.map((snapshot) => `file:${snapshot.id}`));
      },
    });
    const unpublish = (service as { unpublish?: (id: string) => Promise<unknown> }).unpublish;

    await expect(unpublish?.("article-1")).resolves.toMatchObject({
      id: "article-1",
      slug: "published-article",
      attachmentsRemoved: 1,
    });
    expect(events).toEqual(["database:article-1", "file:snapshot-1"]);
  });

  it("keeps invalid JSON tag entries out of public article data", async () => {
    const article = {
      id: "article-1",
      slug: "typed-tags",
      markdown: "# Article",
      title: "Typed tags",
      summary: null,
      tags: ["typescript", 42, null],
      publishedAt: new Date("2026-09-18T08:00:00.000Z"),
    };
    const service = createKnowledgeArticleService({
      async findDraft() { return draft; },
      async createArticle() { throw new Error("not used"); },
      async findArticle() { return null; },
      async deleteArticle() { throw new Error("not used"); },
      async listPublicArticles() { return [article]; },
      async getPublicArticle() { return article; },
    } as Parameters<typeof createKnowledgeArticleService>[0]);

    await expect(service.listPublicArticles()).resolves.toMatchObject([
      { id: "article-1", tags: ["typescript"] },
    ]);
    await expect(service.getPublicArticle("typed-tags")).resolves.toMatchObject({
      id: "article-1",
      tags: ["typescript"],
    });
  });
});
