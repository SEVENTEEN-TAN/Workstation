import { describe, expect, it } from "vitest";

import { buildKnowledgeSyncReport } from "../src/lib/knowledge/sync-report";

function note(relativePath: string, contentHash: string, modifiedAt = "2026-09-16T04:00:00.000Z") {
  return { relativePath, contentHash, modifiedAt: new Date(modifiedAt) };
}

describe("knowledge sync reports", () => {
  it("treats every note in a first scan as added", () => {
    const report = buildKnowledgeSyncReport([], [note("notes/a.md", "a"), note("notes/b.md", "b")]);

    expect(report.summary).toMatchObject({ addedCount: 2, modifiedCount: 0, movedCount: 0, missingCount: 0, unchangedCount: 0 });
    expect(report.changes).toEqual([
      expect.objectContaining({ type: "ADDED", currentRelativePath: "notes/a.md" }),
      expect.objectContaining({ type: "ADDED", currentRelativePath: "notes/b.md" }),
    ]);
  });

  it("keeps unchanged content out of change entries even when its timestamp changes", () => {
    const report = buildKnowledgeSyncReport(
      [note("notes/a.md", "same", "2026-09-15T04:00:00.000Z")],
      [note("notes/a.md", "same", "2026-09-16T04:00:00.000Z")],
    );

    expect(report.summary).toMatchObject({ addedCount: 0, modifiedCount: 0, movedCount: 0, missingCount: 0, unchangedCount: 1 });
    expect(report.changes).toEqual([]);
  });

  it("records content edits at the same path with both source states", () => {
    const report = buildKnowledgeSyncReport(
      [note("notes/a.md", "before", "2026-09-15T04:00:00.000Z")],
      [note("notes/a.md", "after", "2026-09-16T04:00:00.000Z")],
    );

    expect(report.summary).toMatchObject({ modifiedCount: 1 });
    expect(report.changes).toEqual([expect.objectContaining({
      type: "MODIFIED",
      previousRelativePath: "notes/a.md",
      currentRelativePath: "notes/a.md",
      previousContentHash: "before",
      currentContentHash: "after",
    })]);
  });

  it("pairs a unique matching hash as a move", () => {
    const report = buildKnowledgeSyncReport([note("old/a.md", "same")], [note("new/a.md", "same")]);

    expect(report.summary).toMatchObject({ addedCount: 0, movedCount: 1, missingCount: 0 });
    expect(report.changes).toEqual([expect.objectContaining({ type: "MOVED", previousRelativePath: "old/a.md", currentRelativePath: "new/a.md" })]);
  });

  it("leaves duplicate hashes as added and missing for manual review", () => {
    const report = buildKnowledgeSyncReport(
      [note("old/a.md", "same"), note("old/b.md", "same")],
      [note("new/a.md", "same"), note("new/b.md", "same")],
    );

    expect(report.summary).toMatchObject({ addedCount: 2, movedCount: 0, missingCount: 2 });
    expect(report.changes.map((change) => change.type)).toEqual(["ADDED", "ADDED", "MISSING", "MISSING"]);
  });
});
