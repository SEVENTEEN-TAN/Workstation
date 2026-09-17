# Knowledge Sync Reports Design

## Purpose

Extend the read-only Obsidian vault index with a durable report for every successful manual scan. The report identifies added, modified, moved, missing, and unchanged Markdown records before replacing the active index. Obsidian remains the source of truth; no scan writes to the vault or changes publication state.

## Scope

This iteration provides:

- a full-scan comparison between the persisted note index and a newly scanned result;
- deterministic change classification using relative paths, content hashes, and source modification times;
- one persistent summary report and itemized change records per successful scan;
- a concise latest-report summary and change list in the existing admin knowledge workspace;
- automatic preservation of the old index and report history when scanning fails.

It does not provide background watching, incremental filesystem traversal, Windows-to-server transport, source conflict resolution, note-body storage, publication changes, or deletion propagation.

## Change Classification

- `UNCHANGED`: the same relative path has the same content hash. A changed source modification time alone does not create a content change.
- `MODIFIED`: the same relative path has a different content hash. The report preserves the before and after hashes and modification times.
- `MOVED`: an old path disappeared and a new path appeared with the same hash, only when that hash maps to exactly one missing old record and exactly one added new record.
- `ADDED`: a new path remains after move pairing.
- `MISSING`: an old path remains after move pairing. It is deliberately phrased as a possible deletion because an ignore-rule or unavailable source can cause the same observation.

Duplicate hashes are never paired as moves. They stay as separate added and missing records so an administrator can review the ambiguity safely.

## Data Model

`KnowledgeSyncReport` belongs to a vault and stores scan time plus counts for added, modified, moved, missing, and unchanged files. `KnowledgeSyncChange` belongs to a report and stores its type, the previous and current relative paths, hashes, and modification times. Deleting a vault cascades to reports and changes. Reports contain metadata only.

The scan service computes the comparison before opening the write transaction. On success one transaction creates the report and its changes, replaces the current note index, and updates scan status. On failure it only marks the vault scan as failed and keeps the previous index and report history.

## Admin Experience

The existing `扫描知识库` action remains the only trigger. After completion, the current vault card shows its latest report counts. The index panel presents the latest report with a compact list of changes, including old and new paths when a file moved. Empty reports explicitly state that no content-level changes were detected.

## Testing

- Pure comparison tests cover first scans, unchanged metadata, modified content, unambiguous moves, duplicate-hash ambiguity, additions, and possible deletions.
- Service tests prove reports and index replacement occur together and failed scans preserve both prior data sets.
- Admin contract tests cover report rendering and scan feedback.
- Prisma validation, a fresh migration deployment, TypeScript, lint, full Vitest, and production build must pass before merge.
