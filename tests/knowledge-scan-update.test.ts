import { describe, expect, it } from "vitest";

import { mergeScannedVault } from "../src/components/admin/knowledge-scan-update";
import type { KnowledgePublicationDraftData, KnowledgeVaultData } from "../src/components/admin/types";

const draft: KnowledgePublicationDraftData = {
  id: "draft", sourceRevisionId: "revision", sourceHash: "hash", title: "Note", summary: null,
  tags: [], status: "DRAFT", createdAt: "2026-09-30", updatedAt: "2026-09-30", attachments: [], article: null,
};
function vault(): KnowledgeVaultData {
  return {
    id: "vault", name: "Vault", rootPath: "C:/fixture", enabled: true, ignorePatterns: [],
    lastScanStatus: "SUCCESS", lastScannedAt: null, lastScanFileCount: 1, lastScanError: null,
    createdAt: "2026-09-30", updatedAt: "2026-09-30", notes: [], noteLinks: [],
    sourceRevisions: [{ id: "revision", vaultId: "vault", relativePath: "note.md", contentHash: "hash", origin: "LOCAL_SCAN", capturedAt: "2026-09-30", draft: null }],
    syncReports: [{ id: "report", scannedAt: "2026-09-30", addedCount: 0, modifiedCount: 1, movedCount: 0, missingCount: 0, unchangedCount: 0, changes: [{ id: "change", type: "MODIFIED", previousRelativePath: "note.md", currentRelativePath: "note.md", previousContentHash: "old", currentContentHash: "hash", previousModifiedAt: null, currentModifiedAt: null, reviewDecision: null, reviewedAt: null }] }],
  };
}

describe("knowledge scan response reconciliation", () => {
  it("retains a draft created while the scan response was pending and accepts new scan revisions", () => {
    const before = vault(), current = vault(), scanned = vault();
    current.sourceRevisions[0].draft = draft;
    scanned.sourceRevisions.unshift({ ...scanned.sourceRevisions[0], id: "new-revision", contentHash: "new-hash" });
    const merged = mergeScannedVault(before, current, scanned);
    expect(merged.sourceRevisions.map((item) => item.id)).toEqual(["new-revision", "revision"]);
    expect(merged.sourceRevisions[1].draft).toEqual(draft);
  });

  it.each([true, false])("retains newer attachment and publication state, published=%s", (published) => {
    const before = vault();
    before.sourceRevisions[0].draft = { ...draft, article: { id: "old-article", draftId: draft.id, slug: "note", publishedAt: "2026-09-30" } };
    const scanned = structuredClone(before);
    const current = { ...before, sourceRevisions: [{ ...before.sourceRevisions[0], draft: { ...draft, attachments: [{ id: "attachment", target: "image.png", assetId: "blue" }], article: published ? { id: "new-article", draftId: draft.id, slug: "note", publishedAt: "2026-09-30" } : null } }] };
    expect(mergeScannedVault(before, current, scanned).sourceRevisions[0].draft).toEqual(current.sourceRevisions[0].draft);
  });

  it("retains review decisions completed during a scan", () => {
    const before = vault(), current = vault(), scanned = vault();
    current.syncReports[0].changes[0] = { ...current.syncReports[0].changes[0], reviewDecision: "ACKNOWLEDGED", reviewedAt: "2026-09-30T10:00:00Z" };
    expect(mergeScannedVault(before, current, scanned).syncReports[0].changes[0]).toEqual(current.syncReports[0].changes[0]);
  });

  it("accepts refreshed server publication state when no local operation completed during the scan", () => {
    const before = vault(), scanned = vault();
    before.sourceRevisions[0].draft = draft;
    scanned.sourceRevisions[0].draft = { ...draft, attachments: [{ id: "attachment", target: "image.png", assetId: "remote" }] };
    expect(mergeScannedVault(before, before, scanned).sourceRevisions[0].draft).toEqual(scanned.sourceRevisions[0].draft);
  });
});
