import type { Prisma } from "@prisma/client";

import { getDatabase } from "../db";
import { scanVault, type ScannedKnowledgeLink, type ScannedKnowledgeNote, type VaultScanResult } from "../knowledge/vault-scanner";
import { buildKnowledgeSyncReport, type KnowledgeNoteSnapshot, type KnowledgeSyncReportInput } from "../knowledge/sync-report";
import { knowledgeVaultInputSchema, knowledgeVaultPatchSchema } from "../validators/knowledge-vaults";

export type KnowledgeVaultRecord = {
  id: string;
  name: string;
  rootPath: string;
  enabled: boolean;
  ignorePatterns: unknown;
  lastScanStatus: string;
  lastScannedAt: Date | null;
  lastScanFileCount: number;
  lastScanError: string | null;
  notes?: KnowledgeNoteSnapshot[];
};

type KnowledgeVaultRepository = {
  listVaults(): Promise<KnowledgeVaultRecord[]>;
  findVault(id: string): Promise<KnowledgeVaultRecord | null>;
  createVault(value: { name: string; rootPath: string; enabled: boolean; ignorePatterns: string[] }): Promise<unknown>;
  updateVault(id: string, value: Record<string, unknown>): Promise<unknown>;
  deleteVault(id: string): Promise<unknown>;
  replaceIndex(id: string, result: VaultScanResult, report: KnowledgeSyncReportInput): Promise<unknown>;
  markScanFailed(id: string, message: string): Promise<unknown>;
};

function parseIgnorePatterns(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function noteData(vaultId: string, indexedAt: Date, note: ScannedKnowledgeNote) {
  const { sha256, frontmatter, ...rest } = note;
  return { vaultId, indexedAt, contentHash: sha256, frontmatterJson: frontmatter ? JSON.stringify(frontmatter) : null, ...rest };
}

function linkData(vaultId: string, indexedAt: Date, link: ScannedKnowledgeLink) {
  return { vaultId, indexedAt, ...link };
}

function defaultRepository(): KnowledgeVaultRepository {
  return {
    async listVaults() {
      return (await getDatabase()).knowledgeVault.findMany({
        include: { notes: { orderBy: { relativePath: "asc" } }, noteLinks: { orderBy: { sourceRelativePath: "asc" } }, syncReports: { orderBy: { scannedAt: "desc" }, take: 1, include: { changes: true } } },
        orderBy: { name: "asc" },
      });
    },
    async findVault(id) {
      return (await getDatabase()).knowledgeVault.findUnique({ where: { id }, include: { notes: true, noteLinks: true } });
    },
    async createVault(value) {
      return (await getDatabase()).knowledgeVault.create({ data: value, include: { notes: true, noteLinks: true, syncReports: { include: { changes: true } } } });
    },
    async updateVault(id, value) {
      return (await getDatabase()).knowledgeVault.update({
        where: { id },
        data: value as Prisma.KnowledgeVaultUpdateInput,
        include: { notes: { orderBy: { relativePath: "asc" } }, noteLinks: { orderBy: { sourceRelativePath: "asc" } }, syncReports: { orderBy: { scannedAt: "desc" }, take: 1, include: { changes: true } } },
      });
    },
    async deleteVault(id) {
      return (await getDatabase()).knowledgeVault.delete({ where: { id } });
    },
    async replaceIndex(id, result, report) {
      const database = await getDatabase();
      const operations: Prisma.PrismaPromise<unknown>[] = [
        database.knowledgeNoteLink.deleteMany({ where: { vaultId: id } }),
        database.knowledgeNote.deleteMany({ where: { vaultId: id } }),
      ];
      if (result.notes.length) {
        operations.push(database.knowledgeNote.createMany({
          data: result.notes.map((note) => noteData(id, result.scannedAt, note)),
        }));
      }
      if (result.links.length) {
        operations.push(database.knowledgeNoteLink.createMany({
          data: result.links.map((link) => linkData(id, result.scannedAt, link)),
        }));
      }
      operations.push(database.knowledgeSyncReport.create({
        data: {
          vaultId: id,
          scannedAt: result.scannedAt,
          ...report.summary,
          changes: { createMany: { data: report.changes } },
        },
      }));
      operations.push(database.knowledgeVault.update({
        where: { id },
        data: {
          lastScanStatus: "SUCCESS",
          lastScannedAt: result.scannedAt,
          lastScanFileCount: result.notes.length,
          lastScanError: null,
        },
        include: { notes: { orderBy: { relativePath: "asc" } }, noteLinks: { orderBy: { sourceRelativePath: "asc" } }, syncReports: { orderBy: { scannedAt: "desc" }, take: 1, include: { changes: true } } },
      }));
      const results = await database.$transaction(operations);
      return results.at(-1);
    },
    async markScanFailed(id, message) {
      return (await getDatabase()).knowledgeVault.update({
        where: { id },
        data: { lastScanStatus: "FAILED", lastScanError: message.slice(0, 1_000) },
        include: { notes: { orderBy: { relativePath: "asc" } }, noteLinks: { orderBy: { sourceRelativePath: "asc" } }, syncReports: { orderBy: { scannedAt: "desc" }, take: 1, include: { changes: true } } },
      });
    },
  };
}

export function createKnowledgeVaultService(
  repository: KnowledgeVaultRepository = defaultRepository(),
  scanner: (rootPath: string, ignorePatterns: readonly string[]) => Promise<VaultScanResult> = scanVault,
) {
  return {
    list: () => repository.listVaults(),
    create: (input: unknown) => repository.createVault(knowledgeVaultInputSchema.parse(input)),
    async update(id: string, input: unknown) {
      const patch = knowledgeVaultPatchSchema.parse(input);
      const current = await repository.findVault(id);
      if (!current) throw new Error("Knowledge vault not found");
      const complete = knowledgeVaultInputSchema.parse({
        ...current,
        ignorePatterns: parseIgnorePatterns(current.ignorePatterns),
        ...patch,
      });
      return repository.updateVault(id, Object.fromEntries(
        Object.keys(patch).map((key) => [key, complete[key as keyof typeof complete]]),
      ));
    },
    async remove(id: string) {
      const current = await repository.findVault(id);
      if (!current) throw new Error("Knowledge vault not found");
      return repository.deleteVault(id);
    },
    async scan(id: string) {
      const current = await repository.findVault(id);
      if (!current) throw new Error("Knowledge vault not found");
      if (!current.enabled) throw new Error("Vault is disabled");
      try {
        const result = await scanner(current.rootPath, parseIgnorePatterns(current.ignorePatterns));
        const report = buildKnowledgeSyncReport(current.notes ?? [], result.notes.map((note) => ({
          relativePath: note.relativePath,
          contentHash: note.sha256,
          modifiedAt: note.modifiedAt,
        })));
        return await repository.replaceIndex(id, result, report);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Vault scan failed";
        await repository.markScanFailed(id, message);
        throw error;
      }
    },
  };
}

export const knowledgeVaultService = createKnowledgeVaultService();
