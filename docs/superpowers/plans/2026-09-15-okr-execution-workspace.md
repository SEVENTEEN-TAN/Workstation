# OKR Execution Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a cycle-centered OKR execution workspace with routed detail views, structured editing, KR check-ins, Action Items, risk signals, and review guidance.

**Architecture:** Extend the existing Prisma and service layer with Action Items and focused queries, keep risk calculations in pure functions, and split the current nested client page into route-specific workspaces. Existing admin feedback, confirmation, styling, and authentication primitives remain the interaction foundation.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 6, SQLite, Zod 4, Vitest, CSS Modules, Lucide React.

**Spec:** `docs/superpowers/specs/2026-09-15-okr-execution-workspace-design.md`

## Global Constraints

- Preserve the current Dark Studio black, white, and neon green palette.
- Do not change the public homepage structure, CSS, animation, breakpoints, image ratios, or interactions.
- Action Item completion must not mutate KR progress.
- Do not expose Action Items in public OKR data.
- Add no third-party runtime dependencies.

---

### Task 1: Derived Execution State

**Files:**
- Create: `src/lib/okr/execution.ts`
- Create: `tests/okr-execution.test.ts`

**Interfaces:**
- Produces: `getKeyResultExecutionState(input, now)`, `summarizeObjective(objective, now)`, and `summarizeCycle(cycle, now)`.

- [x] Write failing tests for overdue, stale, due-soon risk, completed exclusions, Objective progress, and cycle progress.
- [x] Run `npm test -- tests/okr-execution.test.ts` and verify the missing module failure.
- [x] Implement deterministic pure calculations using the existing progress helpers.
- [x] Re-run the focused tests and keep them green.

### Task 2: Action Item Persistence

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260915000000_add_action_items/migration.sql`
- Modify: `src/lib/validators/okr.ts`
- Modify: `src/lib/services/okr.ts`
- Create: `tests/okr-action-items.test.ts`

**Interfaces:**
- Produces: `actionItemInputSchema`, `createActionItem`, `updateActionItem`, and `deleteActionItem`.

- [x] Write failing validator and service tests for recurrence rules, parent existence, and `completedAt` transitions.
- [x] Run the focused tests and verify expected failures.
- [x] Add the Prisma model, migration, validation, and service methods.
- [x] Generate Prisma Client and re-run the focused tests.

### Task 3: Focused Queries And API

**Files:**
- Modify: `src/lib/services/okr.ts`
- Create: `src/app/api/admin/okr/action-items/route.ts`
- Create: `src/app/api/admin/okr/action-items/[id]/route.ts`
- Modify: `src/app/api/admin/okr/cycles/[id]/route.ts`
- Modify: `src/app/api/admin/okr/objectives/[id]/route.ts`
- Modify: `tests/admin-services.test.ts`

**Interfaces:**
- Produces: authenticated GET detail routes and Action Item CRUD endpoints.

- [x] Write failing service tests for valid lookup, missing records, and cross-cycle Objective boundaries.
- [x] Implement focused Prisma queries and authenticated route handlers.
- [x] Re-run service tests.

### Task 4: Routed Workspaces

**Files:**
- Replace: `src/components/admin/OkrWorkspace.tsx`
- Create: `src/components/admin/okr/OkrCycleListWorkspace.tsx`
- Create: `src/components/admin/okr/OkrCycleWorkspace.tsx`
- Create: `src/components/admin/okr/ObjectiveWorkspace.tsx`
- Create: `src/components/admin/okr/OkrEntityDialog.tsx`
- Create: `src/components/admin/okr/KrCheckInPanel.tsx`
- Create: `src/components/admin/okr/ActionItemList.tsx`
- Create: `src/components/admin/okr/forms.tsx`
- Modify: `src/components/admin/types.ts`
- Modify: `src/app/admin/(workspace)/okr/page.tsx`
- Create: `src/app/admin/(workspace)/okr/cycles/[cycleId]/page.tsx`
- Create: `src/app/admin/(workspace)/okr/cycles/[cycleId]/objectives/[objectiveId]/page.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Consumes: focused service results, execution summaries, existing admin request and feedback primitives.
- Produces: three directly addressable administration views without JSON prompt editing.

- [x] Write UI contract tests for nested routes, dialog editing, history, Action Items, risk labels, and review guidance.
- [x] Run focused UI tests and verify failures.
- [x] Implement route server components and focused client workspaces.
- [x] Add responsive styles using existing colors and geometry.
- [x] Re-run UI tests.

### Task 5: Verification And Roadmap

**Files:**
- Modify: `docs/product-roadmap.md`

- [x] Run `npm test`, `npm run lint`, `npm run db:validate`, and `npm run build`.
- [x] Test admin login and all three OKR routes with `admin / admin` at desktop and mobile widths.
- [x] Verify Action Item completion leaves KR progress unchanged.
- [x] Mark delivered V1.3 TODO items complete and document any deliberately deferred edge.
- [ ] Run `git diff --check`, review the branch diff, commit, push, and open a stacked pull request.
