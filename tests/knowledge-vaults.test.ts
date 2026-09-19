import { describe, expect, it } from "vitest";

import { createKnowledgeVaultService, sourceRevisionRows } from "../src/lib/services/knowledge-vaults";
import type { VaultScanResult } from "../src/lib/knowledge/vault-scanner";

const vault = {
  id: "vault-1",
  name: "Personal Tech",
  rootPath: "F:\\Project\\Obsidian\\PersonalTech",
  enabled: true,
  ignorePatterns: ["private"],
  lastScanStatus: "NEVER",
  lastScannedAt: null,
  lastScanFileCount: 0,
  lastScanError: null,
  notes: [],
};

describe("knowledge vault service", () => {
  it("returns vault lists as JSON-safe views", async () => {
    const createdAt = new Date("2026-09-01T08:00:00.000Z");
    const updatedAt = new Date("2026-09-02T08:00:00.000Z");
    const indexedAt = new Date("2026-09-03T08:00:00.000Z");
    const modifiedAt = new Date("2026-09-03T09:00:00.000Z");
    const capturedAt = new Date("2026-09-04T08:00:00.000Z");
    const publishedAt = new Date("2026-09-05T08:00:00.000Z");
    const scannedAt = new Date("2026-09-06T08:00:00.000Z");
    const reviewedAt = new Date("2026-09-06T09:00:00.000Z");
    const iso = (value: Date) => value.toISOString();
    const record = {
      id: "vault-1",
      name: "Personal Tech",
      rootPath: "F:\\Project\\Obsidian\\PersonalTech",
      enabled: true,
      ignorePatterns: ["private"],
      lastScanStatus: "SUCCESS",
      lastScannedAt: scannedAt,
      lastScanFileCount: 1,
      lastScanError: null,
      createdAt,
      updatedAt,
      notes: [{
        id: "note-1",
        vaultId: "vault-1",
        relativePath: "notes/a.md",
        fileName: "a.md",
        directoryPath: "notes",
        sizeBytes: 12,
        modifiedAt,
        contentHash: "hash-a",
        visibility: "PRIVATE",
        hasFrontmatter: true,
        hasWikilinks: true,
        hasEmbeds: false,
        hasCallouts: false,
        hasDataview: false,
        hasTasks: true,
        isMoc: false,
        frontmatterJson: null,
        indexedAt,
      }],
      noteLinks: [{
        id: "link-1",
        vaultId: "vault-1",
        kind: "LINK",
        sourceRelativePath: "notes/a.md",
        targetRaw: "[[b]]",
        targetRelativePath: "notes/b.md",
        targetHeading: null,
        displayLabel: "b",
        isResolved: true,
        indexedAt,
      }],
      sourceRevisions: [{
        id: "revision-1",
        vaultId: "vault-1",
        relativePath: "notes/a.md",
        contentHash: "hash-a",
        origin: "LOCAL_SCAN",
        capturedAt,
        draft: {
          id: "draft-1",
          sourceRevisionId: "revision-1",
          sourceHash: "hash-a",
          title: "A",
          summary: "Note A",
          tags: ["obsidian"],
          status: "DRAFT",
          createdAt,
          updatedAt,
          attachments: [{ id: "attachment-1", target: "assets/a.png", assetId: "asset-1" }],
          article: { id: "article-1", draftId: "draft-1", slug: "a", publishedAt },
        },
      }],
      syncReports: [{
        id: "report-1",
        vaultId: "vault-1",
        scannedAt,
        addedCount: 1,
        modifiedCount: 0,
        movedCount: 0,
        missingCount: 0,
        unchangedCount: 0,
        changes: [{
          id: "change-1",
          type: "ADDED",
          previousRelativePath: null,
          currentRelativePath: "notes/a.md",
          previousContentHash: null,
          currentContentHash: "hash-a",
          previousModifiedAt: null,
          currentModifiedAt: modifiedAt,
          reviewDecision: "ACKNOWLEDGED",
          reviewedAt,
        }],
      }],
    };
    const service = createKnowledgeVaultService({
      async listVaults() { return [record]; },
      async findVault() { return null; },
      async createVault() { throw new Error("not used"); },
      async updateVault() { throw new Error("not used"); },
      async deleteVault() { throw new Error("not used"); },
      async replaceIndex() { throw new Error("not used"); },
      async markScanFailed() { throw new Error("not used"); },
      async findLatestSourceRevision() { return null; },
    });

    await expect(service.list()).resolves.toEqual([{
      ...record,
      lastScannedAt: iso(scannedAt),
      createdAt: iso(createdAt),
      updatedAt: iso(updatedAt),
      notes: [{ ...record.notes[0], modifiedAt: iso(modifiedAt), indexedAt: iso(indexedAt) }],
      noteLinks: [{ ...record.noteLinks[0], indexedAt: iso(indexedAt) }],
      sourceRevisions: [{
        ...record.sourceRevisions[0],
        capturedAt: iso(capturedAt),
        draft: {
          ...record.sourceRevisions[0].draft,
          createdAt: iso(createdAt),
          updatedAt: iso(updatedAt),
          article: { ...record.sourceRevisions[0].draft.article, publishedAt: iso(publishedAt) },
        },
      }],
      syncReports: [{
        id: "report-1",
        scannedAt: iso(scannedAt),
        addedCount: 1,
        modifiedCount: 0,
        movedCount: 0,
        missingCount: 0,
        unchangedCount: 0,
        changes: [{
          ...record.syncReports[0].changes[0],
          currentModifiedAt: iso(modifiedAt),
          reviewedAt: iso(reviewedAt),
        }],
      }],
    }]);
  });

  it("keeps only unseen path and hash pairs for append-only source revisions", () => {
    const rows = sourceRevisionRows("vault-1", new Date("2026-09-17T00:00:00.000Z"), [{
      relativePath: "notes/a.md",
      fileName: "a.md",
      directoryPath: "notes",
      markdown: "# A changed",
      sizeBytes: 12,
      modifiedAt: new Date("2026-09-17T00:00:00.000Z"),
      sha256: "hash-b",
      hasFrontmatter: false,
      hasWikilinks: false,
      hasEmbeds: false,
      hasCallouts: false,
      hasDataview: false,
      hasTasks: false,
      isMoc: false,
      frontmatter: { title: "A" },
    }, {
      relativePath: "notes/b.md",
      fileName: "b.md",
      directoryPath: "notes",
      markdown: "# B",
      sizeBytes: 12,
      modifiedAt: new Date("2026-09-17T00:00:00.000Z"),
      sha256: "hash-c",
      hasFrontmatter: false,
      hasWikilinks: false,
      hasEmbeds: false,
      hasCallouts: false,
      hasDataview: false,
      hasTasks: false,
      isMoc: false,
      frontmatter: null,
    }], new Set(["notes/a.md\u0000hash-a", "notes/b.md\u0000hash-c"]));

    expect(rows).toEqual([expect.objectContaining({
      vaultId: "vault-1",
      relativePath: "notes/a.md",
      contentHash: "hash-b",
      markdown: "# A changed",
      frontmatterJson: JSON.stringify({ title: "A" }),
      origin: "LOCAL_SCAN",
    })]);
  });

  it("validates registration and delegates normalized values", async () => {
    let created: unknown;
    const service = createKnowledgeVaultService({
      async listVaults() { return []; },
      async findVault() { return null; },
      async createVault(value) { created = value; return { id: "vault-1", ...value, notes: [] }; },
      async updateVault() { throw new Error("not used"); },
      async deleteVault() { throw new Error("not used"); },
      async replaceIndex() { throw new Error("not used"); },
      async markScanFailed() { throw new Error("not used"); },
    });

    await service.create({
      name: "  Personal Tech  ",
      rootPath: " F:\\Project\\Obsidian\\PersonalTech ",
      ignorePatterns: [" private ", "private"],
    });

    expect(created).toEqual({
      name: "Personal Tech",
      rootPath: "F:\\Project\\Obsidian\\PersonalTech",
      ignorePatterns: ["private"],
      enabled: true,
    });
  });

  it("replaces the note index only after a successful scan", async () => {
    const events: string[] = [];
    let receivedReport: unknown;
    const scannedAt = new Date("2026-09-16T04:00:00.000Z");
    const result: VaultScanResult = {
      scannedAt,
      notes: [{
        relativePath: "notes/a.md",
        fileName: "a.md",
        directoryPath: "notes",
        markdown: "# A",
        sizeBytes: 12,
        modifiedAt: new Date("2026-09-16T03:00:00.000Z"),
        sha256: "hash",
        hasFrontmatter: true,
        hasWikilinks: false,
        hasEmbeds: false,
        hasCallouts: false,
        hasDataview: false,
        hasTasks: false,
      }],
    };
    const service = createKnowledgeVaultService({
      async listVaults() { return [vault]; },
      async findVault() { return vault; },
      async createVault() { throw new Error("not used"); },
      async updateVault() { throw new Error("not used"); },
      async deleteVault() { throw new Error("not used"); },
      async replaceIndex(id, scan, ...reports: unknown[]) {
        receivedReport = reports[0];
        events.push(`replace:${id}:${scan.notes.length}`);
        return { ...vault, notes: scan.notes, lastScanStatus: "SUCCESS", lastScannedAt: scan.scannedAt, lastScanFileCount: scan.notes.length };
      },
      async markScanFailed() { throw new Error("not used"); },
    }, async (rootPath, ignores) => {
      events.push(`scan:${rootPath}:${ignores.join(",")}`);
      return result;
    });

    await expect(service.scan("vault-1")).resolves.toMatchObject({ lastScanStatus: "SUCCESS", lastScanFileCount: 1 });
    expect(events).toEqual([
      "scan:F:\\Project\\Obsidian\\PersonalTech:private",
      "replace:vault-1:1",
    ]);
    expect(receivedReport).toMatchObject({ summary: { addedCount: 1, modifiedCount: 0, movedCount: 0, missingCount: 0, unchangedCount: 0 } });
  });

  it("preserves the previous index and records a failed scan", async () => {
    const events: string[] = [];
    const service = createKnowledgeVaultService({
      async listVaults() { return [vault]; },
      async findVault() { return vault; },
      async createVault() { throw new Error("not used"); },
      async updateVault() { throw new Error("not used"); },
      async deleteVault() { throw new Error("not used"); },
      async replaceIndex() { events.push("replace"); throw new Error("must not replace"); },
      async markScanFailed(id, message) { events.push(`failed:${id}:${message}`); return { ...vault, lastScanStatus: "FAILED", lastScanError: message }; },
    }, async () => { throw new Error("Vault unavailable"); });

    await expect(service.scan("vault-1")).rejects.toThrow("Vault unavailable");
    expect(events).toEqual(["failed:vault-1:Vault unavailable"]);
  });

  it("rejects scans for disabled vaults and removes only the index registration", async () => {
    const events: string[] = [];
    const disabled = { ...vault, enabled: false };
    const service = createKnowledgeVaultService({
      async listVaults() { return [disabled]; },
      async findVault() { return disabled; },
      async createVault() { throw new Error("not used"); },
      async updateVault() { throw new Error("not used"); },
      async deleteVault(id) { events.push(`delete:${id}`); return disabled; },
      async replaceIndex() { throw new Error("not used"); },
      async markScanFailed() { throw new Error("not used"); },
    }, async () => { throw new Error("must not scan"); });

    await expect(service.scan("vault-1")).rejects.toThrow("Vault is disabled");
    await service.remove("vault-1");
    expect(events).toEqual(["delete:vault-1"]);
  });

  it("receives a Windows snapshot through the same incremental index flow", async () => {
    const received: { origin?: string; report?: unknown } = {};
    const result: VaultScanResult = {
      scannedAt: new Date("2026-09-17T12:00:00.000Z"),
      notes: [{
        relativePath: "notes/remote.md", fileName: "remote.md", directoryPath: "notes", markdown: "# Remote", sizeBytes: 8,
        modifiedAt: new Date("2026-09-17T12:00:00.000Z"), sha256: "remote-hash", hasFrontmatter: false, hasWikilinks: false,
        hasEmbeds: false, hasCallouts: false, hasDataview: false, hasTasks: false, isMoc: false, frontmatter: null,
      }],
      links: [],
    };
    const service = createKnowledgeVaultService({
      async listVaults() { return [vault]; },
      async findVault() { return vault; },
      async createVault() { throw new Error("not used"); },
      async updateVault() { throw new Error("not used"); },
      async deleteVault() { throw new Error("not used"); },
      async replaceIndex(_id, scan, report, origin) {
        received.origin = origin;
        received.report = report;
        return { ...vault, notes: scan.notes, lastScanStatus: "SUCCESS" };
      },
      async markScanFailed() { throw new Error("not used"); },
    });

    await expect(service.receiveTransportSync("vault-1", result)).resolves.toMatchObject({ addedCount: 1 });
    expect(received.origin).toBe("WINDOWS_SYNC");
    expect(received.report).toMatchObject({ summary: { addedCount: 1 } });
  });

  it("reads only a currently indexed note from an enabled vault", async () => {
    const indexed = { ...vault, notes: [{ relativePath: "notes/a.md", contentHash: "hash", modifiedAt: new Date() }] };
    const service = createKnowledgeVaultService({
      async listVaults() { return [indexed]; },
      async findVault() { return indexed; },
      async createVault() { throw new Error("not used"); },
      async updateVault() { throw new Error("not used"); },
      async deleteVault() { throw new Error("not used"); },
      async replaceIndex() { throw new Error("not used"); },
      async markScanFailed() { throw new Error("not used"); },
      async findLatestSourceRevision(id, relativePath) { return id === "vault-1" && relativePath === "notes/a.md" ? { markdown: "# Stored revision" } : null; },
    }, async () => { throw new Error("not used"); }, async () => { throw new Error("filesystem must not be read"); });

    await expect(service.readNote("vault-1", "notes/a.md")).resolves.toEqual({ relativePath: "notes/a.md", content: "# Stored revision" });
    await expect(service.readNote("vault-1", "notes/missing.md")).rejects.toThrow("Note unavailable");
  });
});
