# Homepage Bootstrap Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the current homepage baseline, make WorkStation own its bootstrap content, and remove every runtime and test dependency on the sibling HomePage project.

**Architecture:** Keep `SiteVersion` as the only runtime homepage source. Move the current bilingual snapshot into a schema-validated bootstrap fixture imported only by database seeding and tests, return `null` when no published version exists, and render one shared public uninitialized state at route boundaries.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6, SQLite, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-homepage-consolidation-design.md`

## Global Constraints

- Do not change public homepage components, CSS, colors, animation parameters, breakpoints, image ratios, navigation behavior, or language behavior.
- Do not delete or archive the sibling HomePage project.
- Keep backups, exported content, media copies, and screenshots outside Git-tracked paths.
- Keep `SiteVersion` draft, preview, publish, history, and restore-to-draft semantics unchanged.
- Do not add a generic CMS, block system, or new homepage section models.

---

### Task 1: Capture the migration baseline

**Files:**
- Modify: `scripts/backup.ts`
- Test: `tests/backup-paths.test.ts`
- Runtime artifact: ignored `data/backups/<timestamp>/homepage-baseline.json`
- Runtime artifact: ignored `data/backups/<timestamp>/homepage-desktop.png`
- Runtime artifact: ignored `data/backups/<timestamp>/homepage-mobile.png`

**Interfaces:**
- Produces: `buildHomepageBaseline(versions, assets)` returning published/draft snapshots plus asset metadata and references.
- Produces: a backup directory containing the SQLite snapshot, uploads, manifest, explicit homepage JSON export, and visual screenshots.

- [x] **Step 1: Write failing baseline-export tests**

Add tests proving that the export keeps only the latest published and latest draft records, validates both snapshots, and includes each asset with its resolved homepage references.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/backup-paths.test.ts`

Expected: FAIL because `buildHomepageBaseline` does not exist.

- [x] **Step 3: Implement the minimal pure exporter and call it from backup**

Query `siteVersion` and `asset`, reuse `findAssetReferences`, validate exported content with `siteContentSchema`, and write `homepage-baseline.json` beside the existing backup manifest.

- [x] **Step 4: Run the backup and capture screenshots**

Run `npm run db:backup`, start the current application, then capture `/` at `1440x1100` and `390x844` into the same backup directory. Verify the JSON and both PNG files exist and are non-empty.

- [x] **Step 5: Re-run focused tests**

Run: `npm test -- tests/backup-paths.test.ts`

Expected: PASS.

### Task 2: Add WorkStation-owned bootstrap content

**Files:**
- Create: `src/lib/content/bootstrap.ts`
- Create: `src/lib/content/seed.ts`
- Modify: `prisma/seed.ts`
- Delete: `src/lib/content/legacy.ts`
- Replace: `tests/legacy-content.test.ts` with `tests/bootstrap-content.test.ts`

**Interfaces:**
- Produces: `bootstrapSiteContent: SiteContent`, parsed once by `siteContentSchema`.
- Produces: `seedPublishedSiteVersion(repository, createdById?)`, creating version 1 only when no site version exists.

- [x] **Step 1: Write failing bootstrap and idempotency tests**

Test that `bootstrapSiteContent` is schema-valid, retains four bilingual projects and known image paths, and that two calls to `seedPublishedSiteVersion` create exactly one published version.

- [x] **Step 2: Verify RED**

Run: `npm test -- tests/bootstrap-content.test.ts`

Expected: FAIL because the bootstrap module and seed helper do not exist.

- [x] **Step 3: Move the current static snapshot without changing values**

Move the complete object currently named `fallbackSiteContent` from `src/components/public/data.ts` into `src/lib/content/bootstrap.ts` and rename it `bootstrapSiteContent`. Do not rewrite copy or project data.

- [x] **Step 4: Make seeding internal and idempotent**

Replace sibling dynamic imports in `prisma/seed.ts` with `bootstrapSiteContent`. Put the single-version guard in `seedPublishedSiteVersion` so the behavior is directly testable.

- [x] **Step 5: Remove the legacy migration helper and test**

Delete `src/lib/content/legacy.ts` and `tests/legacy-content.test.ts`; keep only the WorkStation bootstrap tests.

- [x] **Step 6: Verify GREEN**

Run: `npm test -- tests/bootstrap-content.test.ts`

Expected: PASS.

### Task 3: Remove runtime fallbacks and expose the uninitialized state

**Files:**
- Modify: `src/components/public/data.ts`
- Create: `src/components/public/SiteUninitialized.tsx`
- Modify: `src/lib/services/site-content.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/activities/page.tsx`
- Modify: `src/app/okr/page.tsx`
- Modify: `src/app/projects/page.tsx`
- Modify: `src/app/projects/[slug]/page.tsx`
- Modify: `src/app/experience/page.tsx`
- Modify: `src/app/skills/page.tsx`
- Modify: `tests/public-data.test.ts`
- Modify: `tests/admin-services.test.ts`
- Test: `tests/public-uninitialized.test.ts`

**Interfaces:**
- `createPublicDataAdapter().getPublishedSiteContent()` returns `SiteContent | null`.
- `createSiteContentService().getPublished()` returns `SiteContent | null`.
- `createSiteContentService().getOrCreateDraft()` throws `站点尚未初始化，请先运行数据库种子` if there is neither a draft nor a published version.
- `SiteUninitialized` is the only public route-level empty publication UI.

- [x] **Step 1: Write failing no-publication tests**

Update adapter and service tests to expect `null`, assert draft creation fails without a source snapshot, and add a UI contract test for the shared uninitialized component.

- [x] **Step 2: Verify RED**

Run: `npm test -- tests/public-data.test.ts tests/admin-services.test.ts tests/public-uninitialized.test.ts`

Expected: FAIL because current services return fallback content and the component does not exist.

- [x] **Step 3: Remove the runtime content constant and fallback branches**

Delete `fallbackSiteContent` from `src/components/public/data.ts`. Return `null` from public/service reads when no publication exists, and throw the explicit initialization error when an admin draft has no source.

- [x] **Step 4: Add one restrained public uninitialized component**

Use the fixed Dark Studio colors and a bilingual-neutral message. Include no admin link, database path, stack details, or recovery instructions.

- [x] **Step 5: Guard every public route**

When `getPublishedSiteContent()` returns `null`, return `<SiteUninitialized />`; otherwise pass the database snapshot unchanged into the existing public experience component.

- [x] **Step 6: Replace test fixtures**

Tests that need valid content import `bootstrapSiteContent`; production modules do not.

- [x] **Step 7: Verify GREEN**

Run: `npm test -- tests/public-data.test.ts tests/admin-services.test.ts tests/public-uninitialized.test.ts`

Expected: PASS.

### Task 4: Prove WorkStation-only installation

**Files:**
- Modify: `docs/product-roadmap.md`

**Interfaces:**
- Produces: reproducible evidence that no source/test/script imports the sibling HomePage project.

- [x] **Step 1: Scan for forbidden dependencies**

Search tracked source, tests, scripts, and docs for runtime references to `HomePage/src/data`, `migrateLegacySiteContent`, and sibling `../../HomePage` imports. The historical design/roadmap description may mention the old dependency; executable paths may not.

- [x] **Step 2: Replay migrations and seed on a new temporary SQLite database**

Set `DATABASE_URL` to an ignored temporary database path, run `prisma migrate deploy`, run the seed twice, and verify one published `SiteVersion` exists with schema-valid content.

- [x] **Step 3: Run full verification**

Run: `npm test`, `npm run lint`, `npm run db:validate`, `npm run build`, and `git diff --check`.

- [x] **Step 4: Compare visual output to the baseline**

Render `/` at `1440x1100` and `390x844`, compare against Task 1 screenshots, and confirm no public visual structure changed.

- [x] **Step 5: Update the roadmap**

Check off only the Stage 0/Stage 1 V1.4.1 items proven by this iteration. Leave the admin information architecture, structured project publishing, full retirement audit, and sibling-directory deletion items open.

- [x] **Step 6: Commit, fast-forward merge, verify on main, and push**

Commit the scoped change, merge it into `main` only after verification remains green, run the full test suite on merged `main`, push `main`, verify local/remote SHAs match, and delete the feature branch.
