import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import { knowledgeSyncPayloadSchema } from "../src/lib/knowledge/sync-payload";

const markdown = "# Entry";
const hash = createHash("sha256").update(markdown).digest("hex");
const validPayload = {
  scannedAt: "2026-09-17T12:00:00.000Z",
  notes: [{
    relativePath: "notes/entry.md",
    fileName: "entry.md",
    directoryPath: "notes",
    markdown,
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

  it("rejects note metadata that does not match the Markdown bytes", () => {
    expect(() => knowledgeSyncPayloadSchema.parse({
      ...validPayload,
      notes: [{ ...validPayload.notes[0], sha256: "0".repeat(64) }],
    })).toThrow("笔记内容校验失败");
    expect(() => knowledgeSyncPayloadSchema.parse({
      ...validPayload,
      notes: [{ ...validPayload.notes[0], sizeBytes: validPayload.notes[0].sizeBytes - 1 }],
    })).toThrow("笔记内容校验失败");
  });
});
