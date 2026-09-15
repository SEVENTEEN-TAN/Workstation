# HomePage Consolidation Design

## Status

Approved for planning on 2026-09-16. This design changes no business behavior by itself.

## Goal

Finish the existing HomePage migration by making WorkStation the only deployed application and database-backed source for public homepage content, while preserving the current bilingual content, assets, Dark Studio visual language, responsive behavior, animations, preview, publishing, version history, and rollback safety.

## Current State

- WorkStation already renders the public homepage from the latest published `SiteVersion` and contains the migrated public React components and assets.
- `SiteVersion.content` is one validated bilingual snapshot containing `meta`, `nav`, `hero`, `about`, `works`, `services`, `footer`, and `projects`.
- Fresh database seeding and a legacy-content test still import `../HomePage/src/data/content.js` and `projects.js` through a sibling-directory path.
- WorkStation also carries a complete runtime `fallbackSiteContent`, duplicating the same content a third time.
- `/admin/home` exposes eight implementation-shaped sections, a separate language switch, advanced accessibility and interaction copy at the same level as primary content, publishing controls, and complete history on one screen.
- `docs/product-roadmap.md` already owns development tasks, and V1.5 already includes structured project management and public project routes.

## Constraints

- Preserve all current published and draft content before changing persistence or initialization.
- Preserve asset paths and files; do not replace local media with remote URLs.
- Do not redesign the public homepage or change its components, CSS, animation parameters, breakpoints, image ratios, navigation behavior, or language behavior as part of consolidation.
- Keep the existing `SiteVersion` draft, authenticated preview, atomic publish, version history, and restore-to-draft workflow.
- Do not create one database model per homepage section.
- Do not build a generic CMS, page builder, block system, or configurable navigation framework.
- Structured modules own their records; the homepage selects, orders, and publishes them.
- Do not delete or archive the independent HomePage directory until fresh-install and visual-regression acceptance passes and deletion is separately approved.

## Recommended Approach

Use a staged consolidation rather than rebuilding either application.

### Stage 0: Capture The Migration Baseline

Before implementation, export the current published snapshot, active draft, referenced asset paths, and media files. Capture desktop and mobile screenshots of the current WorkStation public homepage. These artifacts are migration and visual-regression baselines, not a new content system.

### Stage 1: Remove The Sibling HomePage Dependency

Move the current bilingual content into one WorkStation-owned bootstrap fixture used only to initialize an empty database. The seed must load this internal fixture and remain idempotent. Remove the sibling-path imports and the legacy migration helper after their focused tests are replaced.

Public routes must read published database content. Once an internal bootstrap path is verified, remove the complete runtime content fallback so missing publication is explicit rather than silently serving a second source of truth. A missing published version should produce one clear uninitialized state without exposing admin or database details.

Acceptance requires a fresh checkout of WorkStation, with no HomePage sibling directory, to install dependencies, validate Prisma, migrate, seed, run tests, build, and render the preserved published content.

### Stage 2: Simplify Homepage Administration Without A Schema Rewrite

Keep the existing `SiteContent` snapshot and APIs, but reorganize the editor around four user tasks:

1. `个人与首屏`: site metadata, identity, introduction, portrait, and About content.
2. `能力展示`: skills, statistics, capability headings, and capability descriptions.
3. `项目展示`: project-section copy plus project selection and ordering.
4. `联系与导航`: navigation, contact details, social links, and footer content.

Show Chinese and English fields together for the same concept so completeness is visible without switching modes. Put accessibility labels, interaction prompts, and other rarely edited implementation copy in a collapsed `高级文案` area while preserving every existing value and validation rule.

Keep save, preview, and publish in one stable action bar. Move version history into a secondary `发布记录` view or collapsed area so the primary screen focuses on editing. Preserve unsaved-change warnings, validation, readiness checks, preview semantics, atomic publishing, and restore-to-draft behavior.

This stage is an information-architecture change only. It must not add section tables, change the persisted content shape, or modify the public renderer.

### Stage 3: Reuse Structured Projects

Implement the existing V1.5 structured-project roadmap item rather than creating a second project system inside the homepage CMS. Migrate the four current bilingual project records, images, tags, ordering, and alternative text without loss.

Project records become the editing source. The homepage editor only selects featured projects and their display order. At publish time, the selected project presentation is materialized into the immutable `SiteVersion` snapshot so later project edits cannot silently change an already published homepage or historical version.

Project-list and project-detail routes remain part of the existing V1.5 scope. Homepage consolidation must not invent additional portfolio taxonomies, workflows, or relations before those routes need them.

### Stage 4: Retire Independent HomePage

Retirement is allowed only after all of the following pass:

- No WorkStation source, test, script, or documentation path imports HomePage, `content.js`, or `projects.js`.
- A clean WorkStation-only installation can migrate, seed, test, build, and start.
- Published and draft content, bilingual fields, project order, asset references, and media files match the baseline.
- Desktop and mobile visual regression confirms the existing public design is preserved.
- Production deployment and rollback documentation reference WorkStation only.

Deleting or archiving the independent HomePage directory is a separate destructive action and requires explicit approval after these checks.

## Verification Strategy

- Add focused tests for WorkStation-owned bootstrap data and idempotent empty-database seeding.
- Replace the real-HomePage import test with a WorkStation-only bootstrap-schema test.
- Test the explicit no-published-version behavior after removing runtime fallback content.
- Update admin UI contracts for the four task groups, paired bilingual fields, advanced-copy disclosure, and secondary history treatment.
- Preserve existing service tests for save, preview, publish, and restore-to-draft behavior.
- Test project migration and publish-time materialization when structured projects are implemented.
- Run the full test suite, lint, Prisma validation, production build, and whitespace checks.
- Compare the final public homepage against the captured desktop and mobile baselines.

## Out Of Scope

- A public visual redesign or homepage recomposition.
- A generic block editor, page builder, or reusable CMS product.
- Normalizing every homepage section into database tables.
- New roles, approvals, editorial workflows, or multilingual languages beyond Chinese and English.
- Obsidian, GitHub, automation, AI generation, or deployment-server changes.
