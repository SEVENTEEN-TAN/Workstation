# Weekly Activity Drafts Design

## Goal

Generate one editable private weekly draft from selected GitHub activity, OKR execution, portfolio projects, published articles, and manual career activities. Nothing is published automatically.

## Scope

- The administrator selects a start and end date, defaulting to Monday through Sunday.
- Generation includes GitHub events only from repositories selected in GitHub sync.
- OKR evidence includes KR progress updates and completed action items.
- Projects are included when created or updated in the range; articles use `publishedAt`; manual activities use `occurredAt`.
- The generator uses a deterministic bilingual template. AI rewriting remains a later V3 task.
- Regenerating the same start date updates the existing draft instead of creating a duplicate.
- The administrator can edit title and summary, then explicitly convert the draft into a `PRIVATE`, non-featured career activity.

## Data Model

`WeeklyActivityDraft` stores the inclusive week dates, `DRAFT` or `CONVERTED` status, bilingual title and summary, a JSON source snapshot, and the optional career activity created from it. `weekStart` is unique so generation is idempotent.

## Safety

- All routes require an administrator session.
- Drafts are never read by public services.
- Conversion always creates a private career activity.
- The source snapshot stores only existing workstation records and public GitHub event metadata; it does not store credentials or raw GitHub payloads.

## Interface

`/admin/weekly` contains date controls, source counts, draft editing, and an explicit conversion action. Existing Dark Studio colors and shared admin feedback/loading patterns are reused without changing the palette.

## Verification

- Unit tests cover date validation, selected-repository filtering inputs, deterministic summaries, idempotent upsert, and private conversion.
- Admin contract tests cover navigation, authenticated routes, the server page, form fields, loading feedback, and conversion controls.
- Prisma validation, isolated migration, full tests, lint, type checking, and production build must pass before commit.
