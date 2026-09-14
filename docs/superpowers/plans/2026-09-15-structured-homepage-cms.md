# Structured Homepage CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete bilingual homepage form with validation, unsaved-change protection, publish readiness, and restore-to-draft version safety.

**Architecture:** Keep the existing full-snapshot persistence and public rendering contract. Add pure client-safe content editing helpers, change restore semantics inside the existing transactional site-content service, and rebuild `HomeWorkspace` from focused form components while reusing the current admin action and feedback infrastructure.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Zod 4, CSS Modules, Lucide React, Vitest 4, Prisma 6 and SQLite.

**Spec:** `docs/superpowers/specs/2026-09-15-structured-homepage-cms-design.md`

## Global Constraints

- Keep the existing black, white, and neon-green palette unchanged.
- Do not modify public homepage components, CSS, animations, breakpoints, image ratios, public query behavior, Prisma schema, OKR behavior, authentication, or media persistence.
- Use the existing `SiteContent` snapshot and `siteContentSchema`; do not add dependencies.
- Preserve one active draft and require explicit preview plus publish after restoring history.
- Use test-driven development and observe each focused test fail before production edits.

---

### Task 1: Add Client-Safe Content Editing And Validation Contracts

**Files:**
- Modify: `src/lib/content/schema.ts`
- Create: `src/components/admin/home/content-editor.ts`
- Create: `tests/home-content-editor.test.ts`

**Interfaces:**
- Produce `SiteLocale`, `SiteSectionId`, `SITE_SECTION_IDS`, `updateContentAtPath(content, path, value)`, `validateSiteContent(content)`, and `isSiteContentDirty(content, savedContent)`.
- `validateSiteContent` returns `{ valid, fieldErrors, sectionErrorCounts, errorCount }` using dot-path keys.

- [ ] Write focused tests for immutable scalar/array updates, dirty equality, valid snapshots, and invalid `zh`/`en` fields mapped to their section.
- [ ] Run `npm test -- tests/home-content-editor.test.ts` and verify failure because the module does not exist.
- [ ] Export the localized content type from the shared schema and implement the minimal pure helpers.
- [ ] Run the focused test and the existing schema tests; both must pass.
- [ ] Commit with `feat: add homepage content editor contracts`.

---

### Task 2: Restore Historical Versions Into The Single Draft

**Files:**
- Modify: `src/lib/services/site-content.ts`
- Modify: `tests/admin-services.test.ts`

**Interfaces:**
- Extend the transaction repository with `findDraft()` and `updateDraft(id, content)`.
- Preserve `rollback(sourceId, createdById?)` as the API-facing method name, but return a `DRAFT` and never call `archivePublished()` or `publishVersion()`.

- [ ] Add a service test proving restore replaces an existing draft while leaving the published record unchanged.
- [ ] Add a service test proving restore creates the next `DRAFT` with `publishedAt: null` when no draft exists.
- [ ] Run the focused service tests and verify the old immediate-publish behavior fails them.
- [ ] Implement transactional draft lookup/update/create behavior and update existing repository fixtures for the new interface.
- [ ] Run `npm test -- tests/admin-services.test.ts` and then `npm test`; all tests must pass.
- [ ] Commit with `fix: restore homepage history as draft`.

---

### Task 3: Replace JSON Editing With The Complete Bilingual Form

**Files:**
- Create: `src/components/admin/home/HomepageEditor.tsx`
- Create: `src/components/admin/home/FieldError.tsx`
- Create: `src/components/admin/home/CollectionControls.tsx`
- Modify: `src/components/admin/HomeWorkspace.tsx`
- Modify: `src/components/admin/types.ts`
- Modify: `src/app/admin/admin.module.css`
- Modify: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- `HomepageEditor` consumes typed `SiteContent`, active locale/section, validation output, and an `onChange` callback.
- `HomeWorkspace` owns the saved baseline, dirty state, active locale/section, mutation lifecycle, leave guards, preview/publish readiness, and history restore confirmation.

- [ ] Add UI contract tests for all eight section IDs, `中文` and `English`, the absence of the JSON editor copy, dirty `beforeunload` protection, publish readiness, and `恢复为草稿` copy.
- [ ] Run `npm test -- tests/admin-ui-contracts.test.ts` and verify the expected failures.
- [ ] Implement typed initial content, language and section navigation, every scalar/tuple/list/collection editor, inline errors, and accessible collection controls.
- [ ] Implement dirty baseline tracking, browser and same-origin link leave guards, save/refresh/restore replacement behavior, and valid/saved publication gating.
- [ ] Add responsive form CSS using only the existing palette values and breakpoints.
- [ ] Run focused tests, full tests, lint, Prisma validation, build, and `git diff --check`.
- [ ] Verify `/admin/home` at desktop and mobile sizes, then confirm `/` remains visually unchanged.
- [ ] Update the V1.2 items in `docs/product-roadmap.md`, request final branch review, resolve findings, commit, push, and create a stacked PR targeting `feature/admin-experience-foundation`.

