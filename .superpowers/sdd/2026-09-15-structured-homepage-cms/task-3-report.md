# Task 3 Report

## RED evidence

- `npm test -- tests/admin-ui-contracts.test.ts`
- Result before production edits: 5 expected failures, 26 passes. Missing contracts were the eight sections and language controls, JSON replacement/readiness, `beforeunload`, and draft-only restore language.

## GREEN evidence

- `npm test -- tests/admin-ui-contracts.test.ts tests/home-content-editor.test.ts`: 38/38 passed.
- `npm test`: 71/71 passed across 12 files.
- `npm run lint`: passed.
- `DATABASE_URL=file:C:/Users/23399/Desktop/sqtan/WorkStation-v12/prisma/dev.db npm run db:validate`: passed. The first environment-free run reported only the missing `DATABASE_URL`; the scoped absolute SQLite URL resolved it.
- `npm run build`: passed, including TypeScript and all Next.js routes.
- `git diff --check`: recorded after the final file set below.

## Browser evidence

- Desktop 1440 x 1000: eight-section rail and wide form surface rendered; viewport metrics were `scrollWidth 1425 == clientWidth 1425`.
- Mobile 390 x 844: mobile header and horizontal section navigation rendered; viewport metrics were `scrollWidth 390 == clientWidth 390`, with the section rail scrolling internally (`472 > 335`).
- Switched from `中文` to `English`; the English title loaded independently.
- Cleared `en.meta.title`: exact-path error `en.meta.title` appeared, `aria-invalid=true`, and save/publish were disabled.
- Entered a valid title: save enabled, publish stayed disabled, and readiness stated that preview excludes unsaved edits.
- Saved the draft: success feedback appeared, save disabled, publish enabled, and preview rendered the saved `SEVENTEEN — Full-Stack Engineer QA` title.
- About paragraphs: add changed 2 to 3 entries, move down changed value order, and remove restored 2 entries.
- Historical v1 action opened `确认恢复主页版本为草稿` with copy that unsaved edits are replaced, public content remains unchanged, and preview plus publish remain explicit.
- `/` still rendered the published homepage. No public source file was modified.

## Files

- `src/components/admin/home/HomepageEditor.tsx`
- `src/components/admin/home/FieldError.tsx`
- `src/components/admin/home/CollectionControls.tsx`
- `src/components/admin/HomeWorkspace.tsx`
- `src/components/admin/types.ts`
- `src/app/admin/admin.module.css`
- `tests/admin-ui-contracts.test.ts`
- `docs/product-roadmap.md`
- `.superpowers/sdd/2026-09-15-structured-homepage-cms/task-3-report.md`

## Commit

- Current task commit: `feat: add structured homepage cms` (final SHA reported after commit).

## Concerns

- The in-app browser blocked the page's popup call, so the saved draft preview was opened directly with the same draft id; the preview itself rendered and showed the saved edit.
- Local Prisma `db push` required an absolute Windows SQLite `file:` URL; repository configuration was not changed.
- Image fields intentionally remain plain text path/URL inputs; the asset picker roadmap item remains open.
