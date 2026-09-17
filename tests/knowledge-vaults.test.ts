import { describe, expect, it } from "vitest";

import { createKnowledgeVaultService } from "../src/lib/services/knowledge-vaults";
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
    }, async () => { throw new Error("not used"); }, async (rootPath, relativePath) => ({ content: `${rootPath}:${relativePath}` }));

    await expect(service.readNote("vault-1", "notes/a.md")).resolves.toEqual({ relativePath: "notes/a.md", content: "F:\\Project\\Obsidian\\PersonalTech:notes/a.md" });
    await expect(service.readNote("vault-1", "notes/missing.md")).rejects.toThrow("Note unavailable");
  });
});
