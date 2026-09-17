import { describe, expect, it } from "vitest";

import { knowledgeSyncPayloadSchema } from "../src/lib/knowledge/sync-payload";

const hash = "a".repeat(64);
const validPayload = {
  scannedAt: "2026-09-17T12:00:00.000Z",
  notes: [{
    relativePath: "notes/entry.md",
    fileName: "entry.md",
    directoryPath: "notes",
    markdown: "# Entry",
    sizeBytes: 7,
    modifiedAt: "2026-09-17T12:00:00.000Z",
    sha256: hash,
    hasFrontmatter: false,
    hasWikilinks: false,
    hasEmbeds: false,
    hasCallouts: false,
    hasDataview: false,
    hasTasks: false,
    isMoc: false,
    frontmatter: null,
  }],
  links: [{
    kind: "LINK",
    sourceRelativePath: "notes/entry.md",
    targetRaw: "other",
    targetRelativePath: "notes/other.md",
    targetHeading: null,
    displayLabel: null,
    isResolved: true,
  }],
};

describe("knowledge sync payload", () => {
  it("accepts a scanner-compatible Markdown snapshot", () => {
    const result = knowledgeSyncPayloadSchema.parse(validPayload);
    expect(result.scannedAt).toBeInstanceOf(Date);
    expect(result.notes[0].modifiedAt).toBeInstanceOf(Date);
  });

  it("rejects paths, hashes, and duplicate notes outside the transport contract", () => {
    expect(() => knowledgeSyncPayloadSchema.parse({ ...validPayload, notes: [{ ...validPayload.notes[0], relativePath: "../secret.md" }] })).toThrow();
    expect(() => knowledgeSyncPayloadSchema.parse({ ...validPayload, notes: [{ ...validPayload.notes[0], sha256: "invalid" }] })).toThrow();
    expect(() => knowledgeSyncPayloadSchema.parse({ ...validPayload, notes: [validPayload.notes[0], { ...validPayload.notes[0] }] })).toThrow();
  });
});
