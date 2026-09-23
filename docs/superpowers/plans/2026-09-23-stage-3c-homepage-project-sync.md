# Stage 3C Homepage Project Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the linked spec before editing. This plan covers D5 only.

**Goal:** Tell administrators when selected source projects differ from the saved homepage cards, let them deliberately sync the current working copy, and require a separate draft save and publication.

**Architecture:** Reuse `selectedProjectIds`, the existing bilingual project materializer, the protected project-list endpoint, and the `HomeWorkspace` working-copy state. A pure comparison reports differences against the saved snapshot; the server verifies submitted cards against current project records instead of rewriting them. No database schema, sync API, background job, or publication path is added.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Vitest 4, Prisma 6 with SQLite, existing admin UI components.

**Spec:** `docs/superpowers/specs/2026-09-23-stage-3-business-closure-design.md`, section “3C：首页项目同步提示” and its error/acceptance sections.

## Global Constraints

- D5 changes only the homepage working copy and draft-save validation. Project editing, published snapshots, and the `publish()` transaction remain unchanged.
- `selectedProjectIds === undefined` is a legacy embedded-card snapshot; `selectedProjectIds: []` is an explicit empty structured selection. Never coerce one to the other.
- Compare only `slug`, `image`, `category`, `title`, `description`, `tags`, and `alt` in both languages, by selected project ID and selection position. Compare `tags` element by element; do not stringify whole content or compare project metadata.
- A selected project that is missing, private, or fails `portfolioProjectInputSchema` cannot sync. Keep the existing materialization error on save.
- Checking projects reads the existing `GET /api/admin/projects`; it must preserve current unsaved homepage edits. Neither checking nor syncing calls the homepage save or publish APIs.
- The embedded preview reads the working copy exactly. Selection/order changes may materialize cards within that same explicit user action; passive preview and saving other homepage fields may not.
- Implement and verify D5 locally. After the Stage 3C browser and full validation gate plus independent review, commit and push `feat/homepage-visual-editor`; do not merge, deploy, or touch production.

## Review Focus

- A legacy snapshot with `selectedProjectIds` absent must retain embedded cards, while an explicit `[]` with leftover cards must be reported and clearable; Task 1, Task 2, and Task 3 tests pin this distinction.
- A change in only the English title or alt, only the Chinese description, or the order of `tags` must be detected even when other fields match; Task 1 tests pin both locales and array order.
- A deleted, private, or incomplete selected project must disable sync without changing the working copy, and draft save must reject it; Task 1, Task 2, and Task 4 tests pin this.
- Checking in another tab's project change while unsaved homepage text, images, links, selection, and preview settings exist must retain them; Task 3/4 tests and browser steps pin this.
- If a source project changes again after sync but before save, the server must reject the stale cards without updating the draft or published homepage; Task 2 tests and the browser gate pin this race.

## File Map

- `src/lib/content/homepage-projects.ts`: retain one materializer and add a typed, field-limited card comparator plus saved-snapshot sync inspection. Remove the preview-only auto-materializer when its last production caller is removed.
- `src/lib/services/site-content.ts`: check draft status and selected-project cards inside the existing repository transaction, reject stale submissions, and preserve legacy input and existing publish behavior.
- `src/components/admin/home/content-editor.ts`: materialize only when an editor action actually changes `selectedProjectIds`; leave ordinary text/link/image edits untouched.
- `src/components/admin/HomeWorkspace.tsx`: use `content` for embedded preview, hold refreshable project-list state, display sync status, and expose check/sync actions.
- `tests/homepage-projects.test.ts`, `tests/home-content-editor.test.ts`, `tests/admin-services.test.ts`, `tests/admin-ui-contracts.test.ts`, and a small `tests/home-project-sync-workspace.test.ts`: replace obsolete automatic-preview/save expectations and cover comparison, service rejection, and visible status. The new test uses `createElement`/`renderToStaticMarkup` and matches this repository's Vitest include.
- `docs/evidence/2026-09-23-stage-3c/`, `docs/2026-09-22-functional-optimization-todo.md`, and `docs/2026-09-22-functional-plan-review.md`: add evidence and mark D5 only after the browser/full gate succeeds. Do not edit these during the planning task.

## Task 1: Inspect saved cards against current source projects

**Files:** Modify `src/lib/content/homepage-projects.ts`; extend `tests/homepage-projects.test.ts`.

**Interfaces:** Export `homepageProjectCardsMatch(actual: SiteContent, expected: SiteContent): boolean` and `inspectHomepageProjectSync(saved: SiteContent, projects: HomepageProjectCandidate[]): HomepageProjectSync`. `HomepageProjectSync` has `status: "legacy" | "synced" | "pending" | "blocked"`, `changes: Array<{ id: string; name: string; fields: Array<{ locale: "zh" | "en"; field: HomepageProjectField }> }>`, `unavailable: Array<{ id: string; name: string; reason: "missing" | "private" | "incomplete" }>`, and `extraCards: boolean`. `HomepageProjectField` is the seven-field union from Global Constraints. Task 2 consumes the matcher; Task 4 consumes the inspection result.

- [ ] **Step 1: Write RED comparison tests.** Use the existing `project()` fixture and `materializeHomepageProjects()` to create a valid saved snapshot for IDs `["first", "second"]`. Change only `second.titleEn`, then only `first.summaryZh`, `coverAltEn`, `coverImage`, and `technologies` order in separate cases. Assert the correct ID and `{ locale, field }` appears and unrelated `updatedAt` changes do not. When `coverAltEn` is null, changing `titleEn` must report both `en.title` and the fallback `en.alt`; the existing fixture's nonempty `coverAltEn` keeps the one-field example below valid. Assert two changed projects report two rows. Assert missing, `PRIVATE`, and incomplete projects return `blocked` with reasons `missing`, `private`, and `incomplete`; a legacy snapshot returns `legacy`; explicit `[]` with empty cards returns `synced`, while `[]` with leftover cards returns `pending` with `extraCards: true`.

```ts
const saved = materializeHomepageProjects(
  { ...structuredClone(bootstrapSiteContent), selectedProjectIds: ["first"] },
  [first],
);
const result = inspectHomepageProjectSync(saved, [{ ...first, titleEn: "Revised" }]);
expect(result.status).toBe("pending");
expect(result.changes).toMatchObject([{ id: "first", fields: [{ locale: "en", field: "title" }] }]);
expect(homepageProjectCardsMatch(saved, saved)).toBe(true);
```

- [ ] **Step 2: Run** `npx vitest run tests/homepage-projects.test.ts`; expect RED because the two exported comparison functions do not exist.
- [ ] **Step 3: Implement the typed comparison.** Use one constant field list, two locale loops, and indexed cards. First classify each unavailable ID as missing, private, or incomplete using the same visibility and `portfolioProjectInputSchema.safeParse` rule as `isSelectableProject()`; only then call `materializeHomepageProjects(saved, projects)`. Derive each row from the selected ID at that index. Use source Chinese title, then saved Chinese card title, then ID as the display-name fallback. Compare array lengths as well as each field so a missing card or surplus card cannot appear synced.

```ts
const HOMEPAGE_PROJECT_FIELDS = ["slug", "image", "category", "title", "description", "tags", "alt"] as const;
type HomepageProjectField = (typeof HOMEPAGE_PROJECT_FIELDS)[number];

function sameField(a: SiteContent["zh"]["projects"][number] | undefined,
                   b: SiteContent["zh"]["projects"][number] | undefined,
                   field: HomepageProjectField) {
  if (!a || !b) return false;
  if (field === "tags") return a.tags.length === b.tags.length && a.tags.every((tag, i) => tag === b.tags[i]);
  return a[field] === b[field];
}
```

- [ ] **Step 4: Re-run** `npx vitest run tests/homepage-projects.test.ts`; expect GREEN. Inspect the implementation to confirm metadata and `JSON.stringify(content)` do not enter project-card comparison.

## Task 2: Reject stale selected-project cards on draft save

**Files:** Modify `src/lib/services/site-content.ts`; update `tests/admin-services.test.ts`.

**Interfaces:** `createSiteContentService(repository).saveDraft(id, input)` keeps its signature and return type. `publish(id)` keeps reading the saved `SiteVersion.content`; the draft route continues to surface `jsonError()` to `adminRequest`.

- [ ] **Step 1: Replace the old auto-materialization expectation with RED service tests.** Import `vi` from Vitest and `type SiteContent` from the content schema for the mock assertions below. The existing “materializes selected projects when saving” test must instead submit already materialized bilingual cards and assert `updateDraft` receives the exact submitted content. Submit the pre-change cards after the transaction's `findProjectsByIds()` returns a changed English title and assert a clear “项目资料已变化，请检查项目更新并同步到工作副本后再保存” rejection with zero `updateDraft` calls. Repeat with a changed Chinese alt and `tags` order. Assert missing/private/incomplete source projects still reject through the existing public-project error. Assert legacy content skips the project lookup and saves unchanged; explicit `[]` with old embedded cards rejects, while `[]` with empty cards saves. Simulate a version already changed to `PUBLISHED` at the transaction's `findVersion(id)` call and assert save rejects without modifying it. Keep the existing `publish()` test proving no project reload.

```ts
const submitted = materializeHomepageProjects(
  { ...structuredClone(bootstrapSiteContent), selectedProjectIds: ["project-1"] },
  [structuredProject],
);
const updateDraft = vi.fn(async (_id: string, content: SiteContent) => ({ ...selectedDraft, content }));
await expect(service.saveDraft("draft", submitted)).rejects.toThrow("项目资料已变化");
expect(updateDraft).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run** `npx vitest run tests/admin-services.test.ts`; expect RED because `saveDraft` currently replaces stale submitted cards and saves successfully.
- [ ] **Step 3: Keep the existing asset check, then make the draft check and project comparison one transaction.** Add `findProjectsByIds(ids: string[]): Promise<PortfolioProjectRecord[]>` to `TransactionRepository` and implement it with `transaction.portfolioProject.findMany`, parsing records as the current repository does. Remove the now unused top-level `SiteContentRepository.findProjectsByIds` and `SiteContentRepository.updateDraft` methods and their Prisma implementations. In `tests/admin-services.test.ts`, move the selected-project fixture's finder and updater into its fake transaction; remove top-level finder/updater stubs and add transaction finder stubs to the existing publish/rollback fakes that construct a full `TransactionRepository`. The two asset-rejection fakes may keep throwing before a transaction starts. Inside `repository.transaction`, read `findVersion(id)` and require `DRAFT`; for `selectedProjectIds !== undefined`, load the selected IDs through that same transaction, materialize a candidate only for checking, and reject if `homepageProjectCardsMatch(content, candidate)` is false. Pass the original `content` to `updateDraft`, whose Prisma `where` must include `status: "DRAFT"` as an additional guard. For undefined, preserve the legacy content without a project lookup. Do not add a synchronization endpoint or change `publish()`.

```ts
return repository.transaction(async (transaction) => {
  const draft = await transaction.findVersion(id);
  if (!draft || draft.status !== "DRAFT") throw new Error("仅草稿版本可以保存");
  if (content.selectedProjectIds !== undefined) {
    const source = await transaction.findProjectsByIds(content.selectedProjectIds);
    const current = materializeHomepageProjects(content, source);
    if (!homepageProjectCardsMatch(content, current)) {
      throw new Error("项目资料已变化，请检查项目更新并同步到工作副本后再保存");
    }
  }
  return toSiteVersionData(await transaction.updateDraft(id, content));
});
```

```ts
// In prismaTransactionRepository:
updateDraft: (id, content) => transaction.siteVersion.update({
  where: { id, status: "DRAFT" },
  data: { content },
}),
async findProjectsByIds(ids) {
  if (!ids.length) return [];
  return (await transaction.portfolioProject.findMany({ where: { id: { in: ids } } }))
    .map(parsePortfolioProjectRecord);
},
```

- [ ] **Step 4: Re-run** `npx vitest run tests/admin-services.test.ts tests/homepage-projects.test.ts`; expect GREEN. Confirm a rejected save leaves both the draft repository and working-copy input untouched.

## Task 3: Make preview and selection honor the working-copy boundary

**Files:** Modify `src/components/admin/home/content-editor.ts`, `src/components/admin/HomeWorkspace.tsx`, `src/lib/content/homepage-projects.ts`; update `tests/home-content-editor.test.ts`, `tests/homepage-projects.test.ts`, and the homepage assertions in `tests/admin-ui-contracts.test.ts`.

**Interfaces:** Export `applyHomepageEditorChange(current: SiteContent, next: SiteContent, projects: HomepageProjectCandidate[]): SiteContent` from `content-editor.ts`. It returns `next` for every unchanged selection and `materializeHomepageProjects(next, projects)` when IDs, order, or legacy-versus-empty selection change. A materialization error propagates before any React state update. Task 4 reuses this behavior while adding sync UI.

- [ ] **Step 1: Write RED behavior tests.** In `tests/home-content-editor.test.ts`, create a saved materialized card, change a source project's title, then edit only `zh.hero.intro`: `applyHomepageEditorChange` must keep both saved project arrays by reference and retain the new intro. Changing `["first"]` to `["second", "first"]` must produce ordered Chinese and English cards immediately while preserving the intro. Migrating legacy `undefined` to `[]` must clear cards; a missing selected project must throw and leave the original object unchanged. In `tests/admin-ui-contracts.test.ts`, assert the preview state sent to the iframe comes from `content`, the field editor uses the selection-aware callback, and all content write paths use one synchronous ref/state commit rather than raw `setContent`. Task 4's browser sequence must commit an iframe edit immediately before syncing and confirm the edit survives.

```ts
const textEdit = { ...saved, zh: { ...saved.zh, hero: { ...saved.zh.hero, intro: "未保存的新介绍" } } };
expect(applyHomepageEditorChange(saved, textEdit, [changedSource]).zh.projects).toBe(textEdit.zh.projects);
const selected = { ...textEdit, selectedProjectIds: ["second", "first"] };
expect(applyHomepageEditorChange(textEdit, selected, [first, second]).en.projects.map((card) => card.slug))
  .toEqual(["second", "first"]);
```

- [ ] **Step 2: Run** `npx vitest run tests/home-content-editor.test.ts tests/admin-ui-contracts.test.ts`; expect RED because the helper and workspace wiring do not exist and preview still auto-materializes.
- [ ] **Step 3: Implement the selection-aware helper.** Treat `undefined` and `[]` as different. For two defined arrays, compare length and each ID in order. Return `next` unchanged when equal; otherwise call the existing strict materializer. Keep `updateHomepageProjectSelection()` and `moveHomepageProjectSelection()` as simple ID operations.

```ts
const sameIds = current.selectedProjectIds === next.selectedProjectIds || (
  current.selectedProjectIds !== undefined && next.selectedProjectIds !== undefined &&
  current.selectedProjectIds.length === next.selectedProjectIds.length &&
  current.selectedProjectIds.every((id, index) => id === next.selectedProjectIds![index])
);
return sameIds ? next : materializeHomepageProjects(next, projects);
```

- [ ] **Step 4: Wire selection-aware editing and synchronous content commits.** Add one local `commitContent(next: SiteContent)` in `HomeWorkspace` that assigns `contentRef.current = next` immediately before `setContent(next)`. Use it for the field editor (after `applyHomepageEditorChange(contentRef.current, next, projects)` succeeds), the visual editor, iframe commits, asset selection, `fetchHomeData()`, and rollback content resets; no content write path may bypass it. For a failed selection change, leave ref/state untouched and report the materialization error through existing `runAction` feedback. Keep ordinary visual text/image edits free of project materialization. Set `previewContent` to `content` and replay that exact object to the iframe; remove the now unused `materializeHomepageProjectsForPreview()` export and update its two obsolete test cases. The stand-alone `/preview?id=...` page continues to read the saved draft.

```ts
const commitContent = useCallback((next: SiteContent) => {
  contentRef.current = next;
  setContent(next);
}, []);

function applyFieldChange(next: SiteContent) {
  try {
    commitContent(applyHomepageEditorChange(contentRef.current, next, projects));
  } catch (cause) {
    void runAction("home:project-selection", async () => { throw cause; });
  }
}
```
- [ ] **Step 5: Re-run** `npx vitest run tests/home-content-editor.test.ts tests/homepage-projects.test.ts tests/admin-ui-contracts.test.ts`; expect GREEN. Inspect the diff for any remaining production call that materializes merely to show a preview.

## Task 4: Expose deliberate check and sync actions in HomeWorkspace

**Files:** Modify `src/components/admin/HomeWorkspace.tsx`; create `tests/home-project-sync-workspace.test.ts`; extend `tests/admin-ui-contracts.test.ts` only for endpoint/wiring assertions that cannot be rendered.

**Interfaces:** `HomeWorkspace` props are unchanged. `projects` becomes `useState(initialProjects)`; `savedSync = inspectHomepageProjectSync(savedContent, projects)` describes the saved snapshot, while `workingSync = inspectHomepageProjectSync(content, projects)` decides whether the current working copy needs synchronization. The existing `GET /api/admin/projects` supplies refresh data.

- [ ] **Step 1: Write RED status-render tests.** Render `HomeWorkspace` with a DRAFT fixture and `initialProjects: []`: a legacy snapshot shows its legacy guidance without a stale-project alert or sync button; explicit `[]` and empty cards shows no pending alert or sync button; explicit `[]` with leftover cards shows the pending notice and enabled sync button; `["missing"]` shows an unavailable notice, a `/admin/projects` link, and a disabled sync button. Assert the check button is available in every case. In the contract test, assert `adminRequest<PortfolioProjectData[]>("/api/admin/projects")` is used and the sync button's disabled expression includes `projectCheckFailed`, `checkBusy`, and `workingSync.status !== "pending"`. The browser gate verifies checking and syncing do not invoke save/publish. Use separate fixtures for the two `[]` cases: `bootstrapSiteContent` already contains four cards per locale, so its plain `selectedProjectIds: []` form is the leftover-card case.

```ts
const leftoverCards = { ...structuredClone(bootstrapSiteContent), selectedProjectIds: [] };
const html = renderToStaticMarkup(createElement(HomeWorkspace, {
  initialDraft: { id: "draft", version: 2, status: "DRAFT", content: leftoverCards, publishedAt: null },
  initialVersions: [], initialProjects: [], assets: [],
}));
expect(html).toContain("检查项目更新");
expect(html).toContain("同步项目更新到工作副本");
const emptyCards = {
  ...leftoverCards,
  zh: { ...leftoverCards.zh, projects: [] },
  en: { ...leftoverCards.en, projects: [] },
};
const emptyHtml = renderToStaticMarkup(createElement(HomeWorkspace, {
  initialDraft: { id: "draft", version: 2, status: "DRAFT", content: emptyCards, publishedAt: null },
  initialVersions: [], initialProjects: [], assets: [],
}));
expect(emptyHtml).not.toContain("同步项目更新到工作副本");
```

- [ ] **Step 2: Run** `npx vitest run tests/home-project-sync-workspace.test.ts tests/admin-ui-contracts.test.ts`; expect RED because there is no check/sync UI.
- [ ] **Step 3: Store and refresh the project list.** `checkProjectUpdates()` calls only the existing protected GET inside `runAction("home:check-projects", ...)`, then updates `projects`. On failure, retain the previous list and every homepage state value; show the normal error feedback and require a successful retry before syncing from a failed check. Track this with one `projectCheckFailed` boolean, reset it only after a successful GET, and disable sync while checking or after failure.

```ts
const [projects, setProjects] = useState(initialProjects);
const [projectCheckFailed, setProjectCheckFailed] = useState(false);
const checked = await runAction("home:check-projects", async () => {
  const latest = await adminRequest<PortfolioProjectData[]>("/api/admin/projects");
  setProjects(latest);
  return true;
}, "项目资料已检查");
setProjectCheckFailed(checked !== true);
```

- [ ] **Step 4: Add the status panel and explicit sync.** Put it near the existing draft action bar so it is visible in visual and field views. List changed project names and localized field labels such as “中文标题、English 描述、封面”; show an extra-card message when `extraCards` is true. Hide the sync button when neither the saved nor working snapshot is `pending` or `blocked`. Show it for a saved `pending` snapshot (including after the working copy has been synced but not saved), or `blocked` status; disable it unless `workingSync.status === "pending"`, the last check succeeded, and no check/sync action is busy. For `blocked`, list each unavailable name and its missing/private/incomplete reason, and link to `/admin/projects`. Inside `runAction`, re-materialize `contentRef.current` with the current `projects` and pass the result to `commitContent` only on success. The existing materializer already changes only `zh.projects` and `en.projects`; it preserves selection/order and all other text/link/image fields. Keep current view, language, device, and selected preview path unchanged. A materialization error occurs before `commitContent`, so `runAction` reports it without changing ref/state. Add an interaction check where an iframe commit immediately precedes sync, and assert that edit remains afterward.

```ts
await runAction("home:sync-projects", async () => {
  const next = materializeHomepageProjects(contentRef.current, projects);
  commitContent(next);
}, "项目更新已同步到工作副本");
```

- [ ] **Step 5: Keep the three operations distinct.** A successful sync sets `dirty`, immediately changes the embedded preview, and displays “请保存草稿后发布”. It does not invoke `saveDraft()` or `publishDraft()`. After `saveDraft()` succeeds and `fetchHomeData()` updates `savedContent`, the saved-snapshot alert clears if no newer source change exists. The publish button stays disabled while the working copy is dirty.
- [ ] **Step 6: Re-run** `npx vitest run tests/home-project-sync-workspace.test.ts tests/admin-ui-contracts.test.ts tests/home-content-editor.test.ts tests/admin-services.test.ts`; expect GREEN. Inspect the `HomeWorkspace` diff to confirm refreshing projects cannot call `setContent` or `setSavedContent`.

## Task 5: Browser acceptance, full Stage 3C gate, review, and branch push

**Files:** Add actual screenshots and short steps under `docs/evidence/2026-09-23-stage-3c/`; update D5 and any genuinely proven F1/F3 status in `docs/2026-09-22-functional-optimization-todo.md` and `docs/2026-09-22-functional-plan-review.md` only where evidence supports it. F2 requires its own real Chinese IME input test and evidence; the D5 browser matrix does not complete F2. Do not modify business files solely to satisfy a checklist.

- [ ] **Step 1: Exercise a disposable local database and browser.** Before creating it, resolve the exact `prisma/.stage3c-validation.db` path inside this worktree and fail if it already exists. Set `DATABASE_URL` to `file:` plus that absolute path with `/` separators; run `npx prisma migrate deploy` and `npm run db:seed`. Start the local app on an unused loopback port. Use the local `/admin/setup` flow if needed; keep credentials out of commands, evidence, commits, and this plan.
- [ ] **Step 2: Capture the D5 browser sequence.** With a selected public project in a saved/published homepage: edit Chinese and English source-card fields in a second admin tab; click “检查项目更新” and verify name/field summary; preserve an unsaved homepage intro/link/image edit, the selection order, current view, locale, and mobile/desktop preview state. Commit an iframe text edit immediately before clicking sync and confirm it survives. Before sync, embedded preview and public `/` must show old cards. Sync and verify only the embedded working-copy cards change and `dirty` becomes true. Before save, `/preview?id=<draft id>` and public `/` still show the old saved cards. Save and verify `/preview` updates while public `/` stays old. Publish explicitly and verify public `/` updates. Save screenshots, short steps, and a sanitized request timeline containing method, path, status, and order: project GET on check; no site draft PUT or publish POST on check/sync; site draft PUT only on save; publish POST only on publish. Do not save raw HAR, cookies, headers, tokens, or credentials in the repository.
- [ ] **Step 3: Exercise rejection and recovery.** Repeat with two changed projects; then set one selected source project to `PRIVATE` and confirm sync is disabled with a project-management link. Restore it to `PUBLIC` and check again. The existing project service blocks deletion while any homepage version references the project, so the missing-project branch is covered by Task 1/2 tests rather than this UI path. Block `GET /api/admin/projects` in the browser once: the check must show an error, keep unsaved content/list state, and disable sync until a successful retry. Sync a project, change its source again before saving, and confirm the save request fails with the stale-card message, retains unsaved homepage edits, and leaves the saved draft/public page unchanged. In the sanitized request timeline, record the failed GET and rejected save response as well as the later successful GET/PUT/POST sequence. Recheck, resync, save, then publish only if the final state is intended in the disposable local environment. Verify legacy `undefined` and explicit empty `[]` separately.
- [ ] **Step 4: Run the focused suite, then the centralized Stage 3C gate.** Run `npx vitest run tests/homepage-projects.test.ts tests/home-content-editor.test.ts tests/admin-services.test.ts tests/home-project-sync-workspace.test.ts tests/admin-ui-contracts.test.ts`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run db:validate`, and `git diff --check`. Create a second, previously nonexistent exact `prisma/.stage3c-build-validation.db` in this worktree, set `DATABASE_URL` to its absolute `file:` URL, then run `npx prisma migrate deploy`, `npm run db:seed`, and `npm run build` against that newly migrated database. Record exact exit codes and test counts; do not point any command at production.
- [ ] **Step 5: Obtain an independent Stage 3C review.** Give the reviewer the spec, this plan, diff, targeted/full results, and browser evidence. Resolve Critical/Important findings with the smallest D5-only change, then rerun affected checks and the full gate. Record any untested matrix cell as unverified rather than complete.
- [ ] **Step 6: Complete the local handoff.** Update D5 and any F1/F3 status only to the extent proven. Leave F2 unchecked unless a separate Chinese IME composition test was actually performed and its evidence saved. Stage only Stage 3C code/tests/evidence/docs, commit one coherent Stage 3C package, and push `feat/homepage-visual-editor`. Verify local and remote branch SHAs match. Report local tests, migration/seed/build, browser acceptance, review, commit, and push separately; do not claim merge, deployment, or production health.
- [ ] **Step 7: Clean only task-created local resources.** Stop the local server session started in Step 1. Resolve and verify the exact `.stage3c-validation.db`, `.stage3c-build-validation.db`, and any SQLite sidecar paths lie inside this worktree's `prisma` directory before removing only those files. Restore the prior process-scoped `DATABASE_URL` value or remove that variable if it was previously absent. Preserve every pre-existing file and process.
