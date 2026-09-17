import { describe, expect, it } from "vitest";

type Revision = {
  id: string;
  relativePath: string;
  contentHash: string;
  capturedAt: string;
  draft: { article: { slug: string } | null } | null;
};

let getPublicationUpdate: ((revisions: Revision[]) => { articleSlug: string; latestRevisionId: string; updateAvailable: boolean } | null) | null = null;
try {
  ({ getPublicationUpdate } = await import("../src/components/admin/knowledge-publication-update"));
} catch {
  // The first red run establishes the missing update-availability behavior.
}

describe("knowledge publication source updates", () => {
  it("keeps a published revision distinct while flagging a newer source revision", () => {
    const revisions: Revision[] = [
      { id: "revision-new", relativePath: "notes/entry.md", contentHash: "new-hash", capturedAt: "2026-09-18T00:00:00.000Z", draft: null },
      { id: "revision-published", relativePath: "notes/entry.md", contentHash: "published-hash", capturedAt: "2026-09-17T00:00:00.000Z", draft: { article: { slug: "entry" } } },
    ];

    expect(getPublicationUpdate).not.toBeNull();
    expect(getPublicationUpdate!(revisions)).toEqual({
      articleSlug: "entry",
      latestRevisionId: "revision-new",
      updateAvailable: true,
    });
  });

  it("does not report an update when the published revision is current", () => {
    const revisions: Revision[] = [{
      id: "revision-published",
      relativePath: "notes/entry.md",
      contentHash: "published-hash",
      capturedAt: "2026-09-17T00:00:00.000Z",
      draft: { article: { slug: "entry" } },
    }];

    expect(getPublicationUpdate!(revisions)).toEqual({
      articleSlug: "entry",
      latestRevisionId: "revision-published",
      updateAvailable: false,
    });
  });

  it("does not report an update after the source returns to the published content", () => {
    const revisions: Revision[] = [
      { id: "revision-new", relativePath: "notes/entry.md", contentHash: "new-hash", capturedAt: "2026-09-18T00:00:00.000Z", draft: null },
      { id: "revision-published", relativePath: "notes/entry.md", contentHash: "published-hash", capturedAt: "2026-09-17T00:00:00.000Z", draft: { article: { slug: "entry" } } },
    ];

    expect(getPublicationUpdate!(revisions, "published-hash")).toMatchObject({ updateAvailable: false });
  });
});
