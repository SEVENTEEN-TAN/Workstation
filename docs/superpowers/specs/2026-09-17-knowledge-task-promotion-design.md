# Knowledge Task Promotion Design

## Goal

Allow an administrator to explicitly turn a Markdown task from a private Obsidian note into an OKR Action Item.

## Rules

- Task extraction only reads standard Markdown task lines; it never writes to the Vault.
- The administrator must choose a target KR before creation.
- Promotion creates one ordinary Action Item through the existing protected API with the task title and `TODO` status.
- It never changes task text, task completion, KR progress, source revisions, or public article content.
- The private note viewer loads available KRs from the existing protected `/api/admin/okr` response only when the administrator opens the promotion control.

## Acceptance Evidence

- Plain list items are not offered for promotion.
- An unauthenticated caller cannot use the existing action-item API.
- A selected task creates an Action Item only after an explicit KR choice.
- Completing the resulting Action Item remains separate from KR progress.
