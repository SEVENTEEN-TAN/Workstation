# Stage 3A Recurring Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. The user's stage-testing instruction groups related RED checks and GREEN checks instead of running the full suite after each small edit.

**Goal:** Completing a daily or weekly OKR action creates exactly one next action, with calendar-correct dates and preserved history.

**Architecture:** A pure date function calculates the next deadline. A single Prisma transaction updates the source and creates the child, guarded by a persisted source marker and a unique child-source reference. Existing OKR routes and list refresh remain unchanged.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6, SQLite, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-23-stage-3-business-closure-design.md`

## Global Constraints

- Business time zone is `Asia/Shanghai`; stored OKR date-only values remain `YYYY-MM-DDT00:00:00.000Z` so existing inputs round-trip.
- Only a transition from non-`DONE` to `DONE` creates a successor; creation of an already-`DONE` action does not.
- A deleted successor does not reset the source's `hasGeneratedNext` marker.
- Source update and successor creation must commit or roll back together; no KR progress update occurs.
- Do not merge, deploy, or modify production. Push the feature branch after the stage passes its tests and review.

## Review Focus

- A deadline at UTC midnight must retain its displayed calendar date after recurrence calculation.
- Completion just before and after Shanghai midnight must anchor an undated action to different dates.
- Two completions of the same source must produce one successor even after a reopen.
- Deleting a successor must not make the source eligible to generate again.
- A failed successor insert must not leave the source marked `DONE` or `hasGeneratedNext`.

## Task 1: Calendar calculation

**Files:** Create `src/lib/okr/recurrence.ts`; create `tests/okr-recurrence.test.ts`.

**Interfaces:** Produce `nextActionDueDate(input: { dueDate: Date | null; completedAt: Date; recurrenceType: "DAILY" | "WEEKLY"; recurrenceInterval: number; recurrenceDays: string | null }): Date`. It returns UTC midnight for the target Shanghai calendar date.

- [x] Add a table-driven test with literal outputs: daily September 30 + 1 → October 1; undated completion at 2026-09-22T15:59Z + 1 → September 23; at 16:01Z + 1 → September 24; weekly Monday/Thursday interval 2, Monday → same Thursday, Thursday → Monday two weeks later; Sunday → next Monday. The test imports `nextActionDueDate` and asserts `.toISOString()`.
- [x] Run `npx vitest run tests/okr-recurrence.test.ts`; expected RED because the module/function is missing.
- [x] Implement the function using `Intl.DateTimeFormat(..., { timeZone: "Asia/Shanghai", year, month, day })` to get the anchor date, `Date.UTC` plus UTC calendar operations for addition, and `getUTCDay()` mapped to 1–7. Parse the already validated `recurrenceDays` string into sorted day numbers. Return a new `Date` at UTC midnight.
- [x] Run the focused test once after the group; expected all cases GREEN.

## Task 2: Atomic, idempotent generation

**Files:** Modify `prisma/schema.prisma`, `src/lib/services/okr.ts`, `tests/okr-action-items.test.ts`; create `prisma/migrations/20260923000000_add_action_item_recurrence_source/migration.sql`.

**Interfaces:** `updateActionItem(id, patch)` keeps its existing return shape. `ActionItem` gains `generatedFromActionItemId String? @unique`, the named self relation with `onDelete: SetNull`, and `hasGeneratedNext Boolean @default(false)`. Existing action input schemas must not accept either server-owned field.

- [x] Extend the service tests as a RED group: `TODO → DONE` daily produces a `TODO` child copying KR, titles, recurrence and sort order; `NONE` does not; a second `DONE` update does not; reopen then complete does not; a simulated child insert failure rolls back both changes; deleting the child then reopening does not generate again. Test the service result and transaction state, not only mocked call counts. Keep existing completion-time test.
- [x] Run `npx vitest run tests/okr-action-items.test.ts`; expected RED on missing successor behavior.
- [x] Add the schema fields and migration: two nullable/source and Boolean columns, a unique index on `generated_from_action_item_id`, and the self-reference with `ON DELETE SET NULL`. Generate Prisma client before TypeScript validation.
- [x] Add a focused transaction adapter in `okr.ts` for the existing repository override. Within one transaction read the current action, validate the merged patch, conditionally claim an eligible source using `updateMany` with `status != DONE` and `hasGeneratedNext = false`, then create one successor with `generatedFromActionItemId`. Set `hasGeneratedNext` in the same transaction. Noneligible updates continue to update only the source. Return the updated source.
- [x] On a conditional claim losing a concurrent race, return the latest source. On a Prisma transaction-conflict or unique-source race, re-read the source; return it only when it is `DONE` and marked generated, otherwise surface the error. Never treat unrelated database failures as success.
- [x] Run `npx vitest run tests/okr-recurrence.test.ts tests/okr-action-items.test.ts`; expected GREEN for all Stage 3A focused cases.

## Task 3: Stage gate and delivery

**Files:** Update `docs/2026-09-22-functional-optimization-todo.md` and `docs/2026-09-22-functional-plan-review.md` only after evidence passes.

- [x] Validate the migration against a newly created temporary SQLite database, apply all migrations, and verify `PRAGMA foreign_key_list(action_items)` and `PRAGMA index_list(action_items)` include the new relationship and unique index. Use the temporary database for a real create/complete/reopen/delete/concurrent case; remove only its verified exact file and any SQLite sidecars.
- [x] Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run db:validate`, `npm run build`, and `git diff --check`. Record counts and failures accurately; fix Stage 3A regressions before declaring completion.
- [x] Obtain an independent whole-stage code review. Fix Critical/Important findings, rerun affected checks and the stage suite, then update D1 and the execution record with exact evidence.
- [ ] Commit Stage 3A code, tests, migration and docs; push `feat/homepage-visual-editor` to GitHub; verify local and remote commit IDs match. Do not merge or deploy.
