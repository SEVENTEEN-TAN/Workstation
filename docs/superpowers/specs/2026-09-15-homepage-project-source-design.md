# Homepage Structured Project Source Design

## Purpose

Make `PortfolioProject` the only editable source for homepage project cards while preserving `SiteVersion` as the immutable public presentation snapshot. The public homepage and authenticated preview must render the same saved snapshot, and edits to a structured project must not mutate an already-published homepage.

This design implements the remaining V1.4.1 roadmap item without changing the public homepage layout, color palette, animation, breakpoints, or interaction behavior.

## Current Problem

The homepage currently has two project sources:

- `/admin/home` edits `SiteContent.en.projects` and `SiteContent.zh.projects` directly.
- `/` loads live `PortfolioProject` rows and lets them override the published `SiteVersion` snapshot.
- `/preview` only receives the saved `SiteVersion` content.

As a result, preview and production can disagree, structured-project edits can silently mutate historical publications, and the homepage CMS duplicates project editing already provided by `/admin/projects`.

## Data Contract

`SiteContent` gains an optional top-level field:

```ts
selectedProjectIds?: string[];
```

The distinction is intentional:

- Missing `selectedProjectIds` means a legacy snapshot whose embedded project cards remain valid and read-only.
- `selectedProjectIds: []` means the administrator explicitly chose to show no homepage projects.
- A non-empty list records the selected structured projects in display order.

Each embedded project card gains an optional `slug`. Legacy cards without a slug continue linking to `/projects`; newly materialized cards link to `/projects/:slug`.

`en.projects` and `zh.projects` remain complete presentation data. They are not foreign-key lookups at render time.

## Materialization

Saving a draft applies these rules:

1. Parse the complete bilingual `SiteContent` snapshot.
2. If `selectedProjectIds` is absent, preserve the existing embedded projects exactly.
3. If it is present, reject duplicate IDs.
4. Load all referenced `PortfolioProject` records.
5. Reject missing, private, or incomplete public records.
6. Reorder records to match `selectedProjectIds`.
7. Replace both locale project arrays with bilingual cards derived from the same records.

The card mapping is:

- `slug` from project slug.
- `image` from `coverImage`, or an empty string when absent.
- `category` from the first technology, falling back to `项目` / `Project`.
- `title` from `titleZh` / `titleEn`.
- `description` from `summaryZh` / `summaryEn`.
- `tags` from the first four technologies.
- `alt` from localized cover alt text, falling back to the localized title.

Publishing does not re-read structured projects. It validates and atomically publishes the already-saved draft, which preserves preview/public parity and publication immutability.

## Admin Experience

`/admin/home` receives the current structured-project list. The existing `项目展示` task keeps the homepage section copy fields, then replaces direct bilingual project-card editing with a selector.

For a new-format draft, the selector:

- Shows project title, visibility, and readiness.
- Allows selecting or removing a project.
- Supports moving selected projects up and down.
- Explains that project details are edited in `/admin/projects`.

For a legacy draft, embedded cards are shown as a read-only compatibility state. The administrator can explicitly switch to structured selection; that action sets `selectedProjectIds` and is the only operation that replaces legacy cards.

No automatic inference is performed because legacy cards do not have stable IDs and generated database IDs cannot be reconstructed safely.

## Public Rendering

The public `/` route reads only the published `SiteVersion`. `HomeExperience` and `RecentWorks` consume only `content[locale].projects`. `/projects` and `/projects/:slug` continue to read structured records directly.

This removes the runtime project override while keeping the public visual component unchanged.

## Deletion Safety

Deleting a structured project remains blocked when it is referenced by skill evidence. It is also blocked when any `SiteVersion` with `selectedProjectIds` includes the project, including archived versions. Historical versions remain restorable, and a currently published homepage cannot lose its linked detail page.

Legacy snapshots cannot be matched to a structured project because they have no source ID; they retain their embedded presentation and their existing `/projects` fallback link.

## Bootstrap Behavior

The bootstrap homepage remains a valid legacy snapshot. A fresh installation can display the preserved homepage immediately and create structured projects through the existing project workspace before explicitly migrating homepage selection.

The seed does not invent detailed project evidence or silently create new source records. This keeps initialization deterministic and avoids claiming project context, responsibility, challenge, approach, or results that the administrator did not author.

## Verification

Automated coverage must prove:

- Legacy snapshots parse without selection IDs or slugs.
- Explicit zero selection is distinct from legacy content.
- Selection order materializes matching bilingual cards and slugs.
- Duplicate, missing, private, or incomplete selections are rejected.
- Saving unrelated legacy content does not clear projects.
- Publishing does not re-materialize from later structured-project edits.
- Project deletion is blocked by any version reference.
- Public homepage and preview both render saved snapshot cards.
- The existing public visual structure and admin interaction contracts remain intact.

Final validation runs the complete test suite, lint, Prisma validation, production build, `git diff --check`, and desktop/mobile browser checks.
