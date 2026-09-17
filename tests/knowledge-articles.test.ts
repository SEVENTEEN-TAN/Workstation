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
      async upsertArticle(input) { return { id: "article-1", ...input }; },
      async listPublicArticles() { return []; },
      async getPublicArticle() { return null; },
    });

    await expect(service.publishDraft("draft-1", "workstation-notes")).resolves.toMatchObject({
      id: "article-1",
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
      async upsertArticle() { throw new Error("not used"); },
      async listPublicArticles() { return []; },
      async getPublicArticle() { return null; },
    });

    await expect(service.publishDraft("draft-1", "with-attachment")).rejects.toThrow("Article not ready");
  });
});
