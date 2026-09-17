import { describe, expect, it } from "vitest";

import { inspectKnowledgePublication } from "../src/components/admin/knowledge-publication-inspector";
import type { KnowledgeNoteData, KnowledgeNoteLinkData } from "../src/components/admin/types";

const note: KnowledgeNoteData = {
  id: "note-1",
  vaultId: "vault-1",
  relativePath: "notes/entry.md",
  fileName: "entry.md",
  directoryPath: "notes",
  sizeBytes: 1,
  modifiedAt: "2026-09-17T00:00:00.000Z",
  contentHash: "hash",
  visibility: "PRIVATE",
  hasFrontmatter: true,
  hasWikilinks: true,
  hasEmbeds: true,
  hasCallouts: false,
  hasDataview: true,
  hasTasks: false,
  isMoc: false,
  frontmatterJson: JSON.stringify({ title: "Entry" }),
  indexedAt: "2026-09-17T00:00:00.000Z",
};

const unresolvedLink: KnowledgeNoteLinkData = {
  id: "link-1",
  kind: "LINK",
  sourceRelativePath: note.relativePath,
  targetRaw: "Missing note",
  targetRelativePath: null,
  targetHeading: null,
  displayLabel: null,
  isResolved: false,
};

describe("knowledge publication inspector", () => {
  it("keeps source notes private while blocking unresolved links and embedded attachments", () => {
    const checks = inspectKnowledgePublication(note, [unresolvedLink, { ...unresolvedLink, id: "embed-1", kind: "EMBED", isResolved: true }]);

    expect(checks.filter((check) => check.status === "BLOCKED").map((check) => check.id)).toEqual(["links", "attachments"]);
    expect(checks).toContainEqual(expect.objectContaining({ id: "visibility", status: "READY" }));
    expect(checks).toContainEqual(expect.objectContaining({ id: "dataview", status: "NOTICE" }));
  });

  it("blocks a public source even when its draft inputs are otherwise complete", () => {
    const checks = inspectKnowledgePublication({ ...note, visibility: "PUBLIC", hasEmbeds: false, hasDataview: false }, []);

    expect(checks).toContainEqual(expect.objectContaining({ id: "visibility", status: "BLOCKED" }));
    expect(checks.filter((check) => check.id !== "visibility").every((check) => check.status === "READY")).toBe(true);
  });
});
