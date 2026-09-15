# Media Library Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver searchable media management, post-upload bilingual metadata editing, previews, upload progress, and homepage asset selection.

**Architecture:** Extend the existing asset service and authenticated routes with a narrow metadata update operation. Keep discovery state inside the current media client component and pass the existing asset records into a reusable picker used by project image fields.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, SQLite, CSS Modules, Vitest, Playwright/browser acceptance.

**Spec:** `docs/superpowers/specs/2026-09-15-media-library-foundation-design.md`

## Global Constraints

- Keep the fixed Dark Studio black, white, and neon-green palette unchanged.
- Do not modify the public homepage visual structure, animation, or rendering behavior.
- Add no dependency; use native browser upload progress, dialog, inputs, and selects.
- Keep manual image URL entry available.
- Leave reference tracking, deletion, and replacement for the next iteration.

---

### Task 1: Asset Metadata Contract

**Files:**
- Modify: `src/lib/services/assets.ts`
- Create: `src/app/api/admin/assets/[id]/route.ts`
- Modify: `tests/admin-services.test.ts`

**Interfaces:**
- Produces: `normalizeAssetAltText(input)` returning trimmed nullable bilingual values.
- Produces: authenticated `PATCH /api/admin/assets/[id]` accepting `{ altTextZh, altTextEn }`.

- [x] Add a failing unit test proving whitespace becomes `null`, normal text is trimmed, and text over 500 characters is rejected.
- [x] Run `npm test -- tests/admin-services.test.ts` and confirm the new test fails because the helper is absent.
- [x] Implement the smallest exported normalizer and use it in upload plus metadata update.
- [x] Add the authenticated id route and return `404` for a missing asset.
- [x] Run the focused service test; run the full suite at the final verification gate.

### Task 2: Media Browser And Editor

**Files:**
- Modify: `src/components/admin/MediaWorkspace.tsx`
- Modify: `src/components/admin/request.ts`
- Modify: `src/app/admin/admin.module.css`
- Modify: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Produces: `uploadAdminAsset(form, onProgress)` with the same error semantics as `adminRequest`.
- Consumes: `PATCH /api/admin/assets/[id]` from Task 1.

- [ ] Add failing contract tests for search/type/alt filters, native progress markup, preview dialog, and shared upload error behavior.
- [ ] Run `npm test -- tests/admin-ui-contracts.test.ts` and confirm expected failures.
- [ ] Add the minimal XHR upload helper without a dependency.
- [ ] Build combined client-side filtering, a filter-empty state, clickable cards, preview dialog, and bilingual alt-text form.
- [ ] Add responsive styles using existing colors, radii, button sizing, and focus patterns.
- [ ] Run focused and full tests.

### Task 3: Homepage Asset Picker

**Files:**
- Create: `src/components/admin/home/AssetPicker.tsx`
- Modify: `src/app/admin/(workspace)/home/page.tsx`
- Modify: `src/components/admin/HomeWorkspace.tsx`
- Modify: `src/components/admin/home/HomepageEditor.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `tests/admin-ui-contracts.test.ts`
- Modify: `docs/product-roadmap.md`

**Interfaces:**
- Produces: `AssetPicker({ assets, open, onSelect, onClose })` selecting an `AssetData` record.
- Consumes: the current `AssetData[]` supplied by the home server page.

- [ ] Add a failing contract test proving the home route supplies assets and project image fields expose the picker while retaining the text input.
- [ ] Run the focused test and confirm failure for the missing picker.
- [ ] Load assets in the existing server-page `Promise.all` and thread them through existing component props.
- [ ] Implement the native-dialog picker with filename/alt search and select action.
- [ ] Connect only project image fields to the picker and keep locale-specific draft updates unchanged.
- [ ] Mark the V1.2 asset-picker TODO and completed V1.4 foundation TODOs in the roadmap.
- [ ] Run full tests, lint, Prisma validation, production build, and browser acceptance at desktop and 390px.
- [ ] Review the diff, commit, push, open a PR against `main`, and merge after successful verification.
