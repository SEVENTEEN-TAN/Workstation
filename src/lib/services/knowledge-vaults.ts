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
  updateVault(id: string, value: {
    name?: string;
    rootPath?: string;
    enabled?: boolean;
    ignorePatterns?: string[];
  }): Promise<unknown>;
  deleteVault(id: string): Promise<unknown>;
  replaceIndex(id: string, result: VaultScanResult, report: KnowledgeSyncReportInput, origin: "LOCAL_SCAN" | "WINDOWS_SYNC"): Promise<unknown>;
  markScanFailed(id: string, message: string): Promise<unknown>;
  findLatestSourceRevision(vaultId: string, relativePath: string): Promise<{ markdown: string } | null>;
};

const vaultDetailsInclude = {
  notes: { orderBy: { relativePath: "asc" } },
  noteLinks: { orderBy: { sourceRelativePath: "asc" } },
  sourceRevisions: {
    orderBy: { capturedAt: "desc" },
    select: {
      id: true,
      vaultId: true,
      relativePath: true,
      contentHash: true,
      origin: true,
      capturedAt: true,
      draft: { select: { id: true, sourceRevisionId: true, sourceHash: true, title: true, summary: true, tags: true, status: true, createdAt: true, updatedAt: true, attachments: { select: { id: true, target: true, assetId: true } }, article: { select: { id: true, draftId: true, slug: true, publishedAt: true } } } },
    },
  },
  syncReports: { orderBy: { scannedAt: "desc" }, take: 1, include: { changes: true } },
} satisfies Prisma.KnowledgeVaultInclude;

function parseIgnorePatterns(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function noteData(vaultId: string, indexedAt: Date, note: ScannedKnowledgeNote) {
  return {
    vaultId,
    indexedAt,
    relativePath: note.relativePath,
    fileName: note.fileName,
    directoryPath: note.directoryPath,
    sizeBytes: note.sizeBytes,
    modifiedAt: note.modifiedAt,
    contentHash: note.sha256,
    frontmatterJson: note.frontmatter ? JSON.stringify(note.frontmatter) : null,
    hasFrontmatter: note.hasFrontmatter,
    hasWikilinks: note.hasWikilinks,
    hasEmbeds: note.hasEmbeds,
    hasCallouts: note.hasCallouts,
    hasDataview: note.hasDataview,
    hasTasks: note.hasTasks,
    isMoc: note.isMoc,
  };
}

export function sourceRevisionRows(vaultId: string, capturedAt: Date, notes: ScannedKnowledgeNote[], existingKeys: ReadonlySet<string>, origin: "LOCAL_SCAN" | "WINDOWS_SYNC" = "LOCAL_SCAN") {
  return notes.filter((note) => !existingKeys.has(`${note.relativePath}\u0000${note.sha256}`)).map((note) => ({
    vaultId,
    relativePath: note.relativePath,
    contentHash: note.sha256,
    markdown: note.markdown,
    frontmatterJson: note.frontmatter ? JSON.stringify(note.frontmatter) : null,
    origin,
    capturedAt,
  }));
}

function linkData(vaultId: string, indexedAt: Date, link: ScannedKnowledgeLink) {
  return { vaultId, indexedAt, ...link };
}

function defaultRepository(): KnowledgeVaultRepository {
  return {
    async listVaults() {
      return (await getDatabase()).knowledgeVault.findMany({
        include: vaultDetailsInclude,
        orderBy: { name: "asc" },
      });
    },
    async findVault(id) {
      return (await getDatabase()).knowledgeVault.findUnique({ where: { id }, include: { notes: true, noteLinks: true } });
    },
    async createVault(value) {
      return (await getDatabase()).knowledgeVault.create({ data: value, include: vaultDetailsInclude });
    },
    async updateVault(id, value) {
      return (await getDatabase()).knowledgeVault.update({
        where: { id },
        data: value,
        include: vaultDetailsInclude,
      });
    },
    async deleteVault(id) {
      return (await getDatabase()).knowledgeVault.delete({ where: { id } });
    },
    async replaceIndex(id, result, report, origin) {
      const database = await getDatabase();
      return database.$transaction(async (transaction) => {
        const existing = result.notes.length ? await transaction.knowledgeSourceRevision.findMany({
          where: {
            vaultId: id,
            OR: result.notes.map((note) => ({ relativePath: note.relativePath, contentHash: note.sha256 })),
          },
          select: { relativePath: true, contentHash: true },
        }) : [];
        const existingKeys = new Set(existing.map((revision) => `${revision.relativePath}\u0000${revision.contentHash}`));
        const revisions = sourceRevisionRows(id, result.scannedAt, result.notes, existingKeys, origin);

        if (revisions.length) await transaction.knowledgeSourceRevision.createMany({ data: revisions });
        await transaction.knowledgeNoteLink.deleteMany({ where: { vaultId: id } });
        await transaction.knowledgeNote.deleteMany({ where: { vaultId: id } });
        if (result.notes.length) await transaction.knowledgeNote.createMany({
          data: result.notes.map((note) => noteData(id, result.scannedAt, note)),
        });
        if (result.links.length) await transaction.knowledgeNoteLink.createMany({
          data: result.links.map((link) => linkData(id, result.scannedAt, link)),
        });
        await transaction.knowledgeSyncReport.create({
          data: {
            vaultId: id,
            scannedAt: result.scannedAt,
            ...report.summary,
            changes: { createMany: { data: report.changes } },
          },
        });
        return transaction.knowledgeVault.update({
          where: { id },
          data: {
            lastScanStatus: "SUCCESS",
            lastScannedAt: result.scannedAt,
            lastScanFileCount: result.notes.length,
            lastScanError: null,
          },
          include: vaultDetailsInclude,
        });
      });
    },
    async markScanFailed(id, message) {
      return (await getDatabase()).knowledgeVault.update({
        where: { id },
        data: { lastScanStatus: "FAILED", lastScanError: message.slice(0, 1_000) },
        include: vaultDetailsInclude,
      });
    },
    async findLatestSourceRevision(vaultId, relativePath) {
      return (await getDatabase()).knowledgeSourceRevision.findFirst({
        where: { vaultId, relativePath },
        orderBy: { capturedAt: "desc" },
        select: { markdown: true },
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
      const update: Parameters<typeof repository.updateVault>[1] = {};
      if (patch.name !== undefined) update.name = complete.name;
      if (patch.rootPath !== undefined) update.rootPath = complete.rootPath;
      if (patch.ignorePatterns !== undefined) update.ignorePatterns = complete.ignorePatterns;
      if (patch.enabled !== undefined) update.enabled = complete.enabled;
      return repository.updateVault(id, update);
    },
    async remove(id: string) {
      const current = await repository.findVault(id);
      if (!current) throw new Error("Knowledge vault not found");
      return repository.deleteVault(id);
    },
    async readNote(id: string, relativePath: string) {
      const current = await repository.findVault(id);
      if (!current?.enabled || !current.notes?.some((note) => note.relativePath === relativePath)) {
        throw new Error("Note unavailable");
      }
      const revision = await repository.findLatestSourceRevision(id, relativePath);
      if (!revision) throw new Error("Note unavailable");
      return { relativePath, content: revision.markdown };
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
        return await repository.replaceIndex(id, result, report, "LOCAL_SCAN");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Vault scan failed";
        await repository.markScanFailed(id, message);
        throw error;
      }
    },
    async receiveTransportSync(id: string, result: VaultScanResult) {
      const current = await repository.findVault(id);
      if (!current) throw new Error("Knowledge vault not found");
      if (!current.enabled) throw new Error("Vault is disabled");
      try {
        const report = buildKnowledgeSyncReport(current.notes ?? [], result.notes.map((note) => ({
          relativePath: note.relativePath,
          contentHash: note.sha256,
          modifiedAt: note.modifiedAt,
        })));
        await repository.replaceIndex(id, result, report, "WINDOWS_SYNC");
        return report.summary;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Knowledge sync failed";
        await repository.markScanFailed(id, message);
        throw error;
      }
    },
  };
}

export const knowledgeVaultService = createKnowledgeVaultService();
