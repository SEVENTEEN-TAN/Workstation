# OKR Execution Workspace Design

## Goal

Replace the single deeply nested OKR administration page with a cycle-centered execution workspace that supports direct navigation, structured editing, KR check-ins, progress history, action items, lightweight recurrence, risk signals, and review guidance.

## Product Boundary

- OKR remains the goal system; Action Items are execution aids owned by a KR, not a standalone task or habit product.
- Completing an Action Item never changes KR progress. It only surfaces a suggestion to record a check-in.
- Public `/okr` behavior remains unchanged and Action Items are never exposed through public queries.
- Existing Dark Studio colors, typography, component geometry, admin shell, feedback patterns, and destructive confirmations remain unchanged.

## Information Architecture

### `/admin/okr`

The OKR index is a cycle list rather than an expanded tree. It provides status and visibility filters, summary counts, cycle progress, risk counts, review state, and a structured create/edit dialog. Selecting a cycle opens its workspace.

### `/admin/okr/cycles/[cycleId]`

The cycle workspace shows cycle metadata, aggregate progress, Objective rows, cycle reviews, and a completion-review prompt. Objective creation and cycle/review editing use structured dialogs. Each Objective row links to its detail route.

### `/admin/okr/cycles/[cycleId]/objectives/[objectiveId]`

The Objective workspace shows weighted progress, KR status and risk signals, Action Items, the selected-KR check-in panel, and progress history. KR and Action Item creation/editing use structured dialogs.

Invalid or cross-cycle identifiers resolve through `notFound()` rather than rendering partial data.

## Data Model

Add `ActionItem` with:

- `id`, `keyResultId`, `titleZh`, optional `titleEn`
- `status`: `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`
- optional `dueDate`, integer `sortOrder`
- `recurrenceType`: `NONE`, `DAILY`, `WEEKLY`
- `recurrenceInterval`: positive integer, default `1`
- optional `recurrenceDays`: comma-separated ISO weekday numbers (`1` to `7`) for weekly recurrence
- optional `completedAt`, plus timestamps

The service validates that weekly recurrence has at least one day and non-weekly recurrence has no recurrence days. Marking an item `DONE` sets `completedAt`; moving it away from `DONE` clears `completedAt`.

## Derived Progress And Risk

Statistics remain derived rather than persisted.

- KR progress uses the existing metric/manual calculation.
- Objective progress is the existing weighted average.
- Cycle progress is the equal average of Objective progress values.
- `overdue`: incomplete KR whose Objective end date or cycle end date is before the current day.
- `stale`: incomplete KR with no check-in for 14 complete days; the fallback activity timestamp is KR `updatedAt`.
- `atRisk`: explicit `AT_RISK`, overdue, or due within seven days while progress is below 70 percent.
- Completed or cancelled KRs are never stale, overdue, or at risk.

Risk derivation is implemented as pure functions with deterministic clock input and unit tests.

## Editing And Feedback

- Remove every JSON `window.prompt` editing path from OKR administration.
- Use native modal dialogs with labelled form controls, inline validation messages, loading state, close/cancel actions, and focus restoration.
- Reuse `adminRequest`, `useAdminAction`, `FeedbackCenter`, and `ConfirmDialog`.
- Server-render initial page data; client mutations call focused API routes and refresh the current route.
- Empty, loading, success, failure, and destructive states use the established admin patterns.

## Service And API

Extend `okrService` with focused queries:

- `listCycles()` returns cycles with Objective/KR data required for cycle summaries.
- `getCycle(cycleId)` returns one cycle with Objectives, KRs, Action Items, progress history, and reviews.
- `getObjective(objectiveId)` returns one Objective with its cycle, KRs, Action Items, progress history, and scoped reviews.
- Action Item create/update/delete methods enforce parent existence and completion timestamp rules.

Add authenticated Action Item routes under `/api/admin/okr/action-items`. Existing CRUD routes remain compatible.

## Review Guidance

When a cycle is `COMPLETED` and has no cycle-level review (`objectiveId` is null), the cycle workspace renders a persistent prompt to create one. The system does not create reviews automatically.

## Testing

- Unit tests cover recurrence validation, completion timestamps, progress summaries, and every risk branch.
- Service tests cover focused lookup boundaries and parent validation.
- UI contract tests prove route availability, removal of JSON prompts, progress history rendering, Action Item controls, and review guidance copy.
- Full tests, lint, Prisma validation, production build, and responsive browser checks complete the iteration.
