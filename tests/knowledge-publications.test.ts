import { describe, expect, it } from "vitest";

import { createKnowledgePublicationService } from "../src/lib/services/knowledge-publications";

const revision = {
  id: "revision-1",
  relativePath: "notes/entry.md",
  contentHash: "hash-1",
  markdown: "# Entry\n\nPrivate source.",
  frontmatterJson: JSON.stringify({
    title: "Entry title",
    summary: "A summary",
    tags: ["knowledge", "career"],
  }),
};

describe("knowledge publication service", () => {
  it("copies a selected source revision into an idempotent private draft", async () => {
    const created: unknown[] = [];
    const service = createKnowledgePublicationService({
      async findSourceRevision(id) { return id === revision.id ? revision : null; },
      async upsertDraft(input) { created.push(input); return { id: "draft-1", ...input }; },
    });

    await expect(service.createDraft(revision.id)).resolves.toMatchObject({
      id: "draft-1",
      sourceRevisionId: revision.id,
      sourceHash: "hash-1",
      markdown: "# Entry\n\nPrivate source.",
      title: "Entry title",
      summary: "A summary",
      tags: ["knowledge", "career"],
      status: "DRAFT",
    });
    expect(created).toEqual([expect.objectContaining({ sourceRevisionId: revision.id })]);
  });

  it("uses the source filename when frontmatter does not provide a title", async () => {
    const service = createKnowledgePublicationService({
      async findSourceRevision() { return { ...revision, relativePath: "nested/fallback-name.md", frontmatterJson: null }; },
      async upsertDraft(input) { return input; },
    });

    await expect(service.createDraft(revision.id)).resolves.toMatchObject({ title: "fallback-name" });
  });

  it("rejects unknown source revisions without exposing storage details", async () => {
    const service = createKnowledgePublicationService({
      async findSourceRevision() { return null; },
      async upsertDraft() { throw new Error("not used"); },
    });

    await expect(service.createDraft("missing")).rejects.toThrow("Source revision unavailable");
  });
});
