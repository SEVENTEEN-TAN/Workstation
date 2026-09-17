# Knowledge Sync Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist and display safe, metadata-only change reports for each successful full Obsidian vault scan.

**Architecture:** A pure comparison helper classifies old indexed notes against a fresh scan result before the existing service replaces the index. Prisma stores report summaries and itemized changes in the same transaction as the new index. The existing scan endpoint returns the updated vault, including its latest report, to the admin workspace.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6 with SQLite, React 19, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-16-knowledge-sync-reports-design.md`

## Global Constraints

- Do not write, rename, move, or delete any file in a registered vault.
- Do not store note bodies, attachment bytes, credentials, or publication state in reports.
- Pair a move only for one missing and one added note with the same hash.
- Preserve the current index and report history if a scan fails.
- Do not add a watcher, queue, glob library, or new runtime dependency.

---

### Task 1: Deterministic scan comparison

**Files:**
- Create: `src/lib/knowledge/sync-report.ts`
- Create: `tests/knowledge-sync-report.test.ts`

**Interfaces:**
- Produces `buildKnowledgeSyncReport(previousNotes, nextNotes)` returning summary counts and `KnowledgeSyncChangeInput[]`.

- [x] Write failing tests for first scans, unchanged records, content edits, unique-hash moves, duplicate-hash ambiguity, additions, and missing notes.
- [x] Run `npm test -- tests/knowledge-sync-report.test.ts` and verify the missing-module failure.
- [x] Implement the smallest pure comparison helper using paths, hashes, and modification times.
- [x] Run `npm test -- tests/knowledge-sync-report.test.ts` and verify all cases pass.

### Task 2: Atomic report persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260916133000_add_knowledge_sync_reports/migration.sql`
- Modify: `src/lib/services/knowledge-vaults.ts`
- Modify: `tests/knowledge-vaults.test.ts`

**Interfaces:**
- Consumes `buildKnowledgeSyncReport(previousNotes, nextNotes)`.
- Extends `replaceIndex(vaultId, result, report)` so reports, changes, and index replacement share one transaction.

- [x] Write failing service tests for successful report persistence and failed-scan preservation.
- [x] Run `npm test -- tests/knowledge-vaults.test.ts` and verify the old repository contract fails.
- [x] Add report/change Prisma models and the SQLite migration with cascade relations and report indexes.
- [x] Generate Prisma Client and update the repository/service with the atomic write path.
- [x] Run `npm test -- tests/knowledge-vaults.test.ts` and verify all cases pass.

### Task 3: Admin report summary

**Files:**
- Modify: `src/components/admin/types.ts`
- Modify: `src/components/admin/KnowledgeWorkspace.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Consumes serialized `KnowledgeSyncReportData` and its latest `KnowledgeSyncChangeData[]` from `KnowledgeVaultData`.

- [x] Write a failing admin contract asserting report summary and change-list rendering.
- [x] Run `npm test -- tests/admin-ui-contracts.test.ts` and verify the assertion fails.
- [x] Render the latest report in the existing vault card and index panel using established loading, empty, and feedback patterns.
- [x] Run `npm test -- tests/admin-ui-contracts.test.ts` and verify the contract passes.

### Task 4: Roadmap and verification

- [x] Mark change detection and full scan reports complete in `docs/product-roadmap.md`.
- [x] Run `npm test`, `npm run lint`, `npx tsc --noEmit`, Prisma validation, a fresh migration deployment, and `npm run build`.
- [x] Inspect `git diff --check` and `git status --short`.
- [ ] Commit, merge into `main`, push `origin/main`, and remove the temporary worktree and feature branch.
