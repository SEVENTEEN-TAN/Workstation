# AI Assisted Drafts Design

## Goal

Connect the configured AI providers to project descriptions, weekly updates, and OKR reviews without allowing generated content to publish or overwrite source records automatically.

## Invariants

- Every AI request resolves the enabled, successfully tested default provider and model for its use case.
- Prompts and responses are never stored in request logs. Logs contain provider, model, latency, token counts, outcome, and a bounded failure reason only.
- Generated project descriptions and OKR reviews are persisted as private `AiContentDraft` records.
- Weekly AI output remains inside the existing private `WeeklyActivityDraft` workflow.
- Each draft stores the complete bounded source snapshot used for generation.
- Applying a project or OKR draft is a separate authenticated action. Applying an OKR draft always creates a `PRIVATE` review.
- Weekly conversion remains an explicit action and always creates a private career activity.
- Invalid or non-JSON model output fails without changing the target record.

## Data Model

`AiContentDraft` stores the use case, target type and ID, status, source snapshot, validated generated content, provider/model metadata, generation time, and optional application time. Multiple generations are retained so a newer suggestion does not destroy earlier comparison evidence.

## Generation Contracts

- `PROJECT_DESCRIPTION` returns bilingual summary, context, responsibility, challenge, approach, and result fields.
- `WEEKLY_UPDATE` returns bilingual title and summary fields.
- `OKR_REVIEW` returns bilingual achievements, problems, lessons, next actions, and an optional 0-10 score.

Responses may be plain JSON or JSON inside a Markdown fence. The service validates the parsed value with Zod before persisting it.

## Admin Flows

- Project workspace: generate from an existing project, inspect source and suggestion, explicitly apply or discard.
- Weekly workspace: create the deterministic source draft first, then optionally ask AI to rewrite that same draft while retaining its source snapshot.
- OKR cycle workspace: generate a cycle review draft from the cycle, objectives, KRs, progress updates, and action items; explicitly apply it as a private review or discard it.

## Failure Behavior

Missing defaults, disabled providers, failed provider tests, missing credentials, invalid output, and upstream failures produce actionable admin feedback. No draft or target record is changed on failure, while a redacted failure log is still recorded when a provider request was attempted.
