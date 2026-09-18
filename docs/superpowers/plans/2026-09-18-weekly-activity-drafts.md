# Weekly Activity Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an administrator-only weekly activity draft workflow that aggregates existing evidence and converts approved copy into a private career activity.

**Architecture:** Add one Prisma draft model and one service that owns range normalization, source aggregation, deterministic copy, idempotent persistence, editing, and conversion. Expose thin authenticated route handlers and a single admin workspace that reuses existing form, feedback, and card patterns.

**Tech Stack:** Next.js, TypeScript, Prisma, SQLite, Zod, Vitest, React, Lucide.

**Spec:** `docs/superpowers/specs/2026-09-18-weekly-activity-drafts-design.md`

## Global Constraints

- Preserve the current homepage and Dark Studio palette.
- Keep generated content private until an administrator explicitly publishes it through an existing public workflow.
- Do not add an AI provider or a new dependency.
- Keep `.verification/` out of Git.

---

### Task 1: Define and test the weekly draft domain

**Files:**
- Create: `tests/weekly-activity-drafts.test.ts`
- Create: `src/lib/services/weekly-activity-drafts.ts`
- Create: `src/lib/validators/weekly-activity-drafts.ts`

- [x] Write failing tests for date ranges, source aggregation, idempotent generation, edits, and private conversion.
- [x] Run the focused test and verify the expected failures.
- [x] Implement the minimum service and validation logic.
- [x] Run the focused test and verify it passes.

### Task 2: Persist weekly drafts

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260918040000_add_weekly_activity_drafts/migration.sql`

- [x] Add the draft model and optional relation to the converted career activity.
- [x] Generate Prisma Client and validate the schema.
- [x] Apply all migrations to a fresh SQLite database.

### Task 3: Add the authenticated admin workflow

**Files:**
- Create: `src/app/admin/(workspace)/weekly/page.tsx`
- Create: `src/app/api/admin/weekly/route.ts`
- Create: `src/app/api/admin/weekly/[id]/route.ts`
- Create: `src/app/api/admin/weekly/[id]/convert/route.ts`
- Create: `src/components/admin/WeeklyActivityWorkspace.tsx`
- Modify: `src/components/admin/types.ts`
- Modify: `src/components/admin/navigation.ts`
- Modify: `tests/admin-ui-contracts.test.ts`

- [x] Add failing admin route and UI contracts.
- [x] Add navigation, server page, authenticated APIs, and the reusable admin form/card experience.
- [x] Run the focused contracts and verify they pass.

### Task 4: Close the roadmap item and verify release quality

**Files:**
- Modify: `docs/product-roadmap.md`

- [x] Mark only the weekly activity draft item complete.
- [x] Run the full test suite, lint, TypeScript, Prisma validation, isolated migrations, and production build.
- [x] Review the diff, commit, and push `main`.
