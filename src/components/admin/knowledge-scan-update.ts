import type { KnowledgeVaultData } from "./types";

export function mergeScannedVault(before: KnowledgeVaultData, current: KnowledgeVaultData, scanned: KnowledgeVaultData): KnowledgeVaultData {
  const beforeRevisions = new Map(before.sourceRevisions.map((revision) => [revision.id, revision]));
  const currentRevisions = new Map(current.sourceRevisions.map((revision) => [revision.id, revision]));
  const beforeChanges = new Map(before.syncReports.flatMap((report) => report.changes.map((change) => [change.id, change] as const)));
  const currentChanges = new Map(current.syncReports.flatMap((report) => report.changes.map((change) => [change.id, change] as const)));
  return {
    ...scanned,
    // Local actions replace draft objects; only changes made during this scan win.
    sourceRevisions: scanned.sourceRevisions.map((revision) => {
      const latest = currentRevisions.get(revision.id);
      return latest && latest.draft !== beforeRevisions.get(revision.id)?.draft
        ? { ...revision, draft: latest.draft }
        : revision;
    }),
    syncReports: scanned.syncReports.map((report) => ({
      ...report,
      changes: report.changes.map((change) => {
        const latest = currentChanges.get(change.id);
        const previous = beforeChanges.get(change.id);
        return latest && (latest.reviewDecision !== previous?.reviewDecision || latest.reviewedAt !== previous?.reviewedAt)
          ? { ...change, reviewDecision: latest.reviewDecision, reviewedAt: latest.reviewedAt }
          : change;
      }),
    })),
  };
}
