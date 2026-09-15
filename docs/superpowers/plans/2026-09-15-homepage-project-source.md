# Homepage Structured Project Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make structured portfolio projects the sole homepage project editing source while storing complete bilingual cards in immutable `SiteVersion` snapshots.

**Architecture:** Add an optional selection reference to the JSON snapshot, materialize selected records when a draft is saved, and remove the public homepage's live-project override. Preserve source-less legacy snapshots until the administrator explicitly migrates them.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Prisma, SQLite, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-homepage-project-source-design.md`

## Global Constraints

- Do not change the public homepage layout, color palette, animation parameters, breakpoints, image ratios, or interaction behavior.
- `PortfolioProject` is the only editable source for new homepage project selections.
- Public and preview homepage routes render only the saved `SiteVersion` snapshot.
- Missing `selectedProjectIds` means legacy embedded content; an empty array means an explicit zero-project selection.
- Publishing must not re-read structured projects or mutate the saved draft snapshot.
- No new database relation table or speculative content migration.
- Follow test-driven development: observe every new behavioral test fail before implementation.

---

### Task 1: Snapshot Contract And Project Materialization

**Files:**
- Modify: `src/lib/content/schema.ts`
- Create: `src/lib/content/homepage-projects.ts`
- Modify: `src/lib/services/site-content.ts`
- Modify: `tests/site-content-schema.test.ts`
- Create: `tests/homepage-projects.test.ts`
- Modify: `tests/admin-services.test.ts`

**Interfaces:**
- Produces: `SiteContent.selectedProjectIds?: string[]`
- Produces: `materializeHomepageProjects(content: SiteContent, projects: PortfolioProjectRecord[]): SiteContent`
- Produces: `findHomepageProjectReferences(projectId: string, versions: SiteVersionRecord[]): SiteVersionRecord[]`
- Extends: `SiteContentRepository.findProjectsByIds(ids: string[]): Promise<PortfolioProjectRecord[]>`

- [ ] **Step 1: Write failing schema tests for legacy, explicit-zero, slug, and duplicate selection behavior**

```ts
expect(siteContentSchema.parse(legacy).selectedProjectIds).toBeUndefined();
expect(siteContentSchema.parse({ ...legacy, selectedProjectIds: [] }).selectedProjectIds).toEqual([]);
expect(siteContentSchema.parse(snapshotWithSlug).en.projects[0].slug).toBe("personal-workstation");
expect(siteContentSchema.safeParse({ ...legacy, selectedProjectIds: ["p1", "p1"] }).success).toBe(false);
```

- [ ] **Step 2: Run schema tests and verify they fail for missing selection/slug support**

Run: `npm test -- tests/site-content-schema.test.ts`

Expected: FAIL because the new fields are stripped or duplicate IDs are accepted.

- [ ] **Step 3: Add the minimal optional schema fields**

```ts
const projectSchema = z.object({
  slug: text.optional(),
  image: z.string(),
  category: text,
  title: text,
  description: text,
  tags: textList,
  alt: text,
});

export const siteContentSchema = z.object({
  selectedProjectIds: z.array(text).refine((ids) => new Set(ids).size === ids.length, "主页项目不能重复").optional(),
  en: localizedSiteContentSchema,
  zh: localizedSiteContentSchema,
});
```

- [ ] **Step 4: Run schema tests and verify they pass**

Run: `npm test -- tests/site-content-schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing materialization tests**

Tests must assert ordered bilingual mapping, explicit empty selection, legacy preservation, and rejection of missing/private/incomplete records.

```ts
const content = { ...bootstrapSiteContent, selectedProjectIds: ["second", "first"] };
expect(materializeHomepageProjects(content, [first, second])).toMatchObject({
  selectedProjectIds: ["second", "first"],
  zh: { projects: [{ slug: "second", title: "第二项" }, { slug: "first", title: "第一项" }] },
  en: { projects: [{ slug: "second", title: "Second" }, { slug: "first", title: "First" }] },
});
```

- [ ] **Step 6: Run materialization tests and verify they fail because the module does not exist**

Run: `npm test -- tests/homepage-projects.test.ts`

Expected: FAIL with a missing module/export error.

- [ ] **Step 7: Implement the minimal mapper and reference scanner**

`materializeHomepageProjects` returns legacy content unchanged when `selectedProjectIds` is absent, maps `[]` to empty locale arrays, indexes supplied records by ID, preserves requested order, and validates every selected record as a complete public `PortfolioProject`.

`findHomepageProjectReferences` parses each version and returns versions whose defined `selectedProjectIds` contains the target ID.

- [ ] **Step 8: Run materialization tests and verify they pass**

Run: `npm test -- tests/homepage-projects.test.ts`

Expected: PASS.

- [ ] **Step 9: Write failing service tests for save-time materialization and publish immutability**

The save test must prove `findProjectsByIds` is skipped for a legacy snapshot and called for a defined selection. The publish test must prove the draft's already-materialized content is published without reading current structured projects.

- [ ] **Step 10: Run service tests and verify the expected failures**

Run: `npm test -- tests/admin-services.test.ts`

Expected: FAIL because the repository has no project loader and `saveDraft` does not materialize selections.

- [ ] **Step 11: Extend the repository and materialize selected projects in `saveDraft` only**

The default repository uses Prisma `findMany({ where: { id: { in: ids } } })` and parses records through `parsePortfolioProjectRecord`. `publish` continues to validate and switch the stored draft without calling the project loader.

- [ ] **Step 12: Run Task 1 tests**

Run: `npm test -- tests/site-content-schema.test.ts tests/homepage-projects.test.ts tests/admin-services.test.ts`

Expected: PASS.

- [ ] **Step 13: Commit Task 1**

```bash
git add src/lib/content/schema.ts src/lib/content/homepage-projects.ts src/lib/services/site-content.ts tests/site-content-schema.test.ts tests/homepage-projects.test.ts tests/admin-services.test.ts
git commit -m "feat: materialize homepage project snapshots"
```

### Task 2: Homepage Project Selection Workspace

**Files:**
- Modify: `src/app/admin/(workspace)/home/page.tsx`
- Modify: `src/components/admin/HomeWorkspace.tsx`
- Modify: `src/components/admin/home/HomepageEditor.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `tests/home-content-editor.test.ts`
- Modify: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Consumes: `SiteContent.selectedProjectIds?: string[]`
- Consumes: `PortfolioProjectData[]`
- Produces: homepage editor changes that only modify `selectedProjectIds`; materialized cards arrive after save/refresh.

- [ ] **Step 1: Write failing editor and UI contract tests**

Tests must prove the project task no longer renders direct card fields or media selection, renders a legacy compatibility state, links to `/admin/projects`, and exposes select/remove/move controls for structured projects.

```ts
expect(editorSource).toContain("selectedProjectIds");
expect(editorSource).toContain("旧版项目快照");
expect(editorSource).toContain('/admin/projects');
expect(editorSource).not.toContain('pairedField(["projects", projectIndex, "title"]');
```

- [ ] **Step 2: Run editor tests and verify they fail against the current direct editor**

Run: `npm test -- tests/home-content-editor.test.ts tests/admin-ui-contracts.test.ts`

Expected: FAIL because the structured selector and compatibility state are absent.

- [ ] **Step 3: Load structured projects on the admin home server page**

Fetch `portfolioProjectService.list()` alongside draft, versions, and assets. Serialize and pass the records as `initialProjects` to `HomeWorkspace`.

- [ ] **Step 4: Thread projects through `HomeWorkspace` and replace direct project editing**

`HomepageEditor` receives `projects: PortfolioProjectData[]`. Its project section keeps the `works` copy fields, shows legacy embedded cards read-only when selection IDs are missing, provides an explicit migration action, shows public projects as selectable, supports removal and ordering, and links to `/admin/projects` for content edits.

- [ ] **Step 5: Add only scoped selector layout styles**

Reuse existing panel, row, button, status, and focus styles. New rules may define selector grid/row layout but must not alter palette tokens or public styles.

- [ ] **Step 6: Run Task 2 tests**

Run: `npm test -- tests/home-content-editor.test.ts tests/admin-ui-contracts.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/app/admin/(workspace)/home/page.tsx src/components/admin/HomeWorkspace.tsx src/components/admin/home/HomepageEditor.tsx src/app/admin/admin.module.css tests/home-content-editor.test.ts tests/admin-ui-contracts.test.ts
git commit -m "feat: select structured projects for homepage"
```

### Task 3: Snapshot-Only Public Rendering And Deletion Protection

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/public/HomeExperience.tsx`
- Modify: `src/components/public/RecentWorks.tsx`
- Modify: `src/components/public/data.ts`
- Modify: `src/lib/services/portfolio-projects.ts`
- Modify: `tests/public-data.test.ts`
- Modify: `tests/portfolio-projects.test.ts`
- Modify: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Consumes: localized cards from `SiteContent.projects`.
- Extends: `PortfolioProjectRepository.listSiteVersions(): Promise<SiteVersionRecord[]>`.

- [ ] **Step 1: Write failing public rendering tests**

Tests must assert snapshot cards retain slug links and that `toRecentProjectViews` no longer accepts or prioritizes live structured-project records.

```ts
expect(toRecentProjectViews("en", snapshotProjects)).toEqual([
  expect.objectContaining({ slug: "personal-workstation", title: "Personal Workstation" }),
]);
```

- [ ] **Step 2: Write a failing deletion-reference test**

The repository fixture returns one version containing `selectedProjectIds: ["project-1"]`; deletion must reject with a homepage-version reference error and must not call `deleteProject`.

- [ ] **Step 3: Run focused tests and verify failures**

Run: `npm test -- tests/public-data.test.ts tests/portfolio-projects.test.ts tests/admin-ui-contracts.test.ts`

Expected: FAIL because live project override APIs remain and deletion ignores site versions.

- [ ] **Step 4: Remove the live homepage project override**

`src/app/page.tsx` loads only published site content. `HomeExperience` passes no project prop. `RecentWorks` creates its cards from `copy.projects`. `toRecentProjectViews` maps only localized snapshot cards and preserves optional slugs.

- [ ] **Step 5: Add version-reference protection to project deletion**

The default repository loads site-version content. Before deleting, `createPortfolioProjectService.delete` rejects when `findHomepageProjectReferences` returns any version. Skill-evidence protection remains unchanged.

- [ ] **Step 6: Run Task 3 tests**

Run: `npm test -- tests/public-data.test.ts tests/portfolio-projects.test.ts tests/admin-ui-contracts.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/app/page.tsx src/components/public/HomeExperience.tsx src/components/public/RecentWorks.tsx src/components/public/data.ts src/lib/services/portfolio-projects.ts tests/public-data.test.ts tests/portfolio-projects.test.ts tests/admin-ui-contracts.test.ts
git commit -m "fix: render homepage projects from published snapshots"
```

### Task 4: Acceptance, Documentation, And Roadmap

**Files:**
- Modify: `docs/product-roadmap.md`
- Modify: implementation files only when verification reveals a regression caused by Tasks 1-3.

**Interfaces:**
- Consumes: the complete feature branch.
- Produces: verified roadmap completion for V1.4.1 item 70.

- [ ] **Step 1: Run complete automated validation**

```bash
npm test
npm run lint
npm run db:validate
npm run build
git diff --check origin/main...HEAD
```

Expected: all commands exit successfully.

- [ ] **Step 2: Run desktop and mobile browser checks**

Start the development server on an unused port. Verify `/`, `/preview?id=<draft>`, `/admin/home`, `/projects`, and one project detail route. Check at desktop and mobile widths that public composition is unchanged, cards use saved snapshot content, selector controls fit without overlap, and legacy/empty states are clear.

- [ ] **Step 3: Mark only roadmap item 70 complete**

Change the checkbox for “Reuse the V1.5 structured-project module…” from `[ ]` to `[x]`. Do not mark item 71 complete without its separate source/deployment and visual regression audit. Do not archive or delete the sibling `HomePage`; item 72 requires separate approval.

- [ ] **Step 4: Commit acceptance evidence**

```bash
git add docs/product-roadmap.md
git commit -m "docs: complete homepage project source migration"
```

- [ ] **Step 5: Request final whole-branch review**

Review `origin/main...HEAD` against the spec, with special attention to legacy preservation, publish immutability, deletion safety, preview/public parity, and public visual regressions.

- [ ] **Step 6: Integrate after a clean review**

Merge the feature branch into `main`, rerun focused verification on `main`, and push `main` to `origin` under the user's standing authorization for routine WorkStation iterations.
