# Stage 3B Entry and Admin Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user's instruction groups full validation at the stage boundary; each task still gets a focused RED/GREEN check.

**Goal:** Make the existing knowledge base and online resume reachable, open converted career activities directly, explain where public content appears, and verify OKR dialogs in a real browser.

**Architecture:** Reuse the current public components, three conversion responses, the server-rendered activities page, and `PublicReadiness`. No new API, publication rule, or generic navigation abstraction. Browser acceptance is required for layout and dialog behavior.

**Tech Stack:** Next.js 16, React, TypeScript, Vitest 4, existing Prisma/SQLite stack.

**Spec:** `docs/superpowers/specs/2026-09-23-stage-3-business-closure-design.md` (section 3B).

## Global Constraints

- D2 is browser acceptance of the existing dialog fix; change dialog code only for a reproduced failure.
- A visible online resume link must not imply a PDF exists. Keep `ResumeToolbar` download gating unchanged.
- Converted activities remain private until the administrator explicitly makes them public.
- Public readiness receives issues/notes from existing shared public rules; static location and next-step text must not make new public decisions.
- Do not merge, deploy, or touch production. Focused task commits may stay local; push the feature branch only after the stage gate and review.

## Review Focus

- At a 375 px viewport, six navigation items must remain reachable without clipping or horizontal page overflow; verify in Task 1's browser check.
- With no public PDF in either language, `/resume` must still be linked while `/api/resume/<locale>` is not offered; pin in Task 1.
- A converted draft with missing `convertedActivityId`, a failed conversion, or a non-`CONVERTED` response must stay in its workspace with its editor and recovery copy intact; pin in Task 3.
- An unknown, repeated-array, or malformed `activity` query must not open a different activity or disclose another record; pin in Task 2.
- A conversion that succeeds before navigation fails must leave a visible activity ID and a manual open link; pin in Task 3.
- Converting draft B while draft A has unsaved edits must not silently discard A: Weekly requires its existing confirmation and recovery, while milestone/timeline conversion waits for the open form to be saved or canceled; pin in Task 3.

## Task 1: Public knowledge and online-resume entry (D3, D4)

**Files:** Modify `src/components/public/Navbar.tsx`, `src/components/public/HomeJourney.tsx`, `tests/homepage-composition.test.ts`; inspect `src/components/public/ResumeToolbar.tsx` without changing its file gate.

**Interfaces:** The existing `HomeExperience` caller keeps passing `resumeDownloads`; only `HomeJourney` stops using it as a condition for the `/resume` link. No new component API.

- [ ] Add a RED rendering test in `tests/homepage-composition.test.ts`: render `HomeExperience` in Chinese and English with `experiences: []` and `resumeDownloads: { zh: false, en: false }`; assert exactly one `href="/knowledge"` and one `href="/resume"` in each rendered homepage. Render `ResumeToolbar` with no downloads and assert no `/api/resume/zh` or `/api/resume/en` link; with a Chinese public file, assert the Chinese download link appears.

```ts
expect(markup).toContain('href="/knowledge"');
expect(markup).toContain('href="/resume"');
expect(markup.match(/href="\/resume"/g)).toHaveLength(1);
```

- [ ] Run `npx vitest run tests/homepage-composition.test.ts`; expect RED because the knowledge link is missing and the no-PDF resume link is hidden.
- [ ] In `Navbar.tsx`, add one localized `Link href="/knowledge"` beside the existing OKR/experience links. In `HomeJourney.tsx`, render the existing `/resume` Link unconditionally and keep the prop type for the existing caller (destructure only `experiences`). Do not move PDF gating from `ResumeToolbar`.

```tsx
<Link href="/knowledge" className="focus-ring text-xs font-semibold tracking-[0.14em] text-accent transition-colors duration-300 hover:text-white sm:text-sm sm:tracking-widest">
  {locale === "zh" ? "知识库" : "Knowledge"}
</Link>
```

- [ ] Re-run the focused test. At the stage browser gate, inspect mobile navigation and add only the smallest horizontal-scroll/wrapping adjustment if the new item is clipped; capture before/after evidence if a fix is needed.
- [ ] Commit the focused D3/D4 change locally with `git add src/components/public/Navbar.tsx src/components/public/HomeJourney.tsx tests/homepage-composition.test.ts` and `git commit -m "feat: expose knowledge and online resume"`. Do not push yet.

## Task 2: Open a specific career activity safely (E2 target)

**Files:** Modify `src/app/admin/(workspace)/activities/page.tsx`, `src/components/admin/CareerActivitiesWorkspace.tsx`; create `tests/admin-activity-target.test.ts` (the Vitest include matches `.test.ts`, not `.test.tsx`).

**Interfaces:** The server page accepts `searchParams: Promise<{ activity?: string | string[] }>` and passes `targetActivityId: string | null` to the workspace. The workspace opens only an ID found in `initialActivities`; its existing `editor` type and save/delete paths remain unchanged.

- [ ] Write a RED test using `createElement`/`renderToStaticMarkup` that renders the async page with `careerActivityService.list()` mocked to return two activities (`activity-1` / `activity-2`). A valid `activity=activity-2` shows the editor with the second record's title. Missing, array, whitespace-only, over-128-character, and unknown IDs leave the list view; an unknown nonempty ID may show `未找到目标动态`. Use a complete `CareerActivityData` fixture: `id`, bilingual titles/summaries, ISO `occurredAt`/`createdAt`/`updatedAt`, `PRIVATE` visibility, `featured: false`, and `linkUrl: null`. Two separate server renders cannot prove that a client navigation replaces stale editor state, so verify `?activity=A` to `?activity=B` on one open page in Task 5.

```ts
const raw = (await searchParams).activity;
const targetActivityId = typeof raw === "string" && raw.length <= 128 && raw.trim()
  ? raw : null;
```

- [ ] Run `npx vitest run tests/admin-activity-target.test.ts`; expect RED because the page does not consume `searchParams` and the workspace starts with `editor: null`.
- [ ] Parse the parameter on the server page, pass `targetActivityId` and `key={targetActivityId ?? "list"}` to `CareerActivitiesWorkspace`, and initialize the editor from `initialActivities.find(item => item.id === targetActivityId) ?? null`. Render a plain status notice for a syntactically valid but unmatched target; do not fetch arbitrary IDs.

```tsx
<CareerActivitiesWorkspace key={targetActivityId ?? "list"}
  initialActivities={activities} targetActivityId={targetActivityId} />
```

- [ ] Re-run the focused test. Keep query parsing and target matching separate from access control: the admin page still relies on its existing protected route and only opens records already loaded for that page. Task 5 must additionally test same-page client navigation from activity A to B.
- [ ] Commit the focused target-opening change locally with `git add 'src/app/admin/(workspace)/activities/page.tsx' src/components/admin/CareerActivitiesWorkspace.tsx tests/admin-activity-target.test.ts` and `git commit -m "feat: open targeted career activity"`. Do not push yet.

## Task 3: Navigate after three successful conversions (E2 sources)

**Files:** Modify `src/components/admin/WeeklyActivityWorkspace.tsx`, `src/components/admin/OkrMilestoneDraftWorkspace.tsx`, `src/components/admin/CareerTimelineDraftWorkspace.tsx`, `src/components/admin/workspace-utils.ts`; create `tests/draft-conversion-navigation.test.ts`.

**Interfaces:** Each conversion API already returns a draft with `status: "DRAFT" | "CONVERTED"` and `convertedActivityId: string | null`. The destination is `/admin/activities?activity=${encodeURIComponent(id)}`. Do not change the APIs or add a second detail page.

- [ ] Add RED tests for a shared `convertedActivityHref` helper: `CONVERTED` with ID `a&b` returns an encoded URL; `DRAFT`, null and empty IDs return null. In the same test file, use the existing source-contract pattern (`readFileSync`) to assert all three workspaces call `router.push` only after this helper returns a target and render a manual converted-row link containing the ID. Pin the conversion guard text for Weekly's dirty edit and milestone/timeline's open form. The stage browser pass must prove actual button interaction, no-target editor preservation, and target editing, because source contracts cannot prove these behaviors.

```ts
expect(convertedActivityHref({ status: "CONVERTED", convertedActivityId: "a&b" }))
  .toBe("/admin/activities?activity=a%26b");
expect(convertedActivityHref({ status: "DRAFT", convertedActivityId: "a" })).toBeNull();
```

- [ ] Run `npx vitest run tests/draft-conversion-navigation.test.ts`; expect RED because all three workspaces currently update the local list without navigating or offering the manual target link.
- [ ] Add `convertedActivityHref(draft: { status: string; convertedActivityId: string | null }): string | null` to existing `workspace-utils.ts`, using `encodeURIComponent` only for a nonempty converted ID. Add `useRouter()` to each client workspace. Before making a conversion request, Weekly keeps blocking conversion of its own dirty draft; when editing A is dirty and converting B, use the existing leave confirmation and retain A's browser recovery copy if confirmed. In milestone/timeline, if any edit form is open, show “请先保存或取消当前编辑，再转换为职业动态” and return without sending a request; these forms hold unsaved input only in the DOM. Remove the current unconditional success message from the three `runAction` calls. After a response, compute `target` **before** clearing recovery or closing any editor. If there is no target, keep drafts, editor, DOM input, and recovery copy unchanged and show a local notice. Only with a valid `CONVERTED` target update the converted row, clear the converted draft's recovery copy where applicable, close its editor, and call `router.push(target)`. API failure continues to use `runAction`'s existing error feedback. For every converted row with an ID, render a manual `Link` to the same destination with the ID in its label so a completed conversion stays discoverable if navigation stalls.

```tsx
const target = convertedActivityHref(converted);
if (target) router.push(target);
else setConversionNotice("转换响应缺少可打开的动态，请检查草稿状态后重试。");
```

- [ ] Re-run focused conversion and target tests. In the browser gate, convert one draft of each source and confirm the destination editor contains that newly converted activity, not merely the activities list. Test editing A then converting B: canceling Weekly's confirmation must make no request; confirming must retain A's recovery copy, while milestone/timeline must block the request until their open editor is saved or canceled. Simulate a successful HTTP response with `DRAFT` or no ID and confirm the current editor/input/recovery remain available with a notice.
- [ ] Commit the focused conversion navigation change locally with `git add src/components/admin/WeeklyActivityWorkspace.tsx src/components/admin/OkrMilestoneDraftWorkspace.tsx src/components/admin/CareerTimelineDraftWorkspace.tsx src/components/admin/workspace-utils.ts tests/draft-conversion-navigation.test.ts` and `git commit -m "feat: navigate to converted activities"`. Do not push yet.

## Task 4: Explain destination and activation without duplicating public rules (E3)

**Files:** Modify `src/components/admin/okr/PublicReadiness.tsx` and its existing callers in `OkrCycleListWorkspace.tsx`, `OkrCycleWorkspace.tsx`, `ObjectiveWorkspace.tsx`, `PortfolioProjectsWorkspace.tsx`, `ExperienceRecordsWorkspace.tsx`, `CareerActivitiesWorkspace.tsx`, `SkillAreasWorkspace.tsx`, `ResumeFilesWorkspace.tsx`; extend `tests/okr-public-readiness.test.ts` and `tests/admin-public-readiness.test.ts`.

**Interfaces:** Add required string props `destination` and `nextStep` to `PublicReadiness`; keep `issues: string[]` and optional `notes: string[]` unchanged. Callers supply static workflow copy. The component never checks visibility or content completeness.

- [ ] Add RED render tests for blocked, ready, and partial records: `issues` still determines the readiness label; `notes` still identify omitted content; `destination` and `nextStep` appear independently of ready/blocked state. Required props plus the stage TypeScript check must cover every caller; inspect configuration-only modules to confirm they are not falsely labeled public.

```ts
const markup = renderToStaticMarkup(createElement(PublicReadiness, {
  issues: ["缺少英文标题"], destination: "项目页 /projects",
  nextStep: "修正公开条件；首页卡片另需同步、保存草稿并发布",
}));
expect(markup).toContain("缺少英文标题");
expect(markup).toContain("展示去向：项目页 /projects");
```

- [ ] Run `npx vitest run tests/okr-public-readiness.test.ts tests/admin-public-readiness.test.ts`; expect RED because the component has no destination/step output.
- [ ] Render two additional lines in `PublicReadiness`: `展示去向：{destination}` and `生效步骤：{nextStep}`. Pass these module-specific static strings at every caller: OKR cycle/objective/review → `/okr` and shared-public readiness without homepage publish; project → `/projects`, with homepage card requiring explicit sync/save/publish; experience → `/experience` and homepage journey; activity → `/activities` and homepage current activity; skill → `/skills` and homepage capability; resume file → `/resume` download only if that file is public and available. Do not pass workflow text that asserts an issue-free record is already published.

```tsx
<span>展示去向：{destination}</span>
<span>生效步骤：{nextStep}</span>
```

- [ ] Re-run focused readiness tests. Visually inspect a blocked and an issue-free record to ensure the static destination does not hide the actual blocking issues. Configuration-only modules remain outside `PublicReadiness` unless they have an actual public content record.
- [ ] Run `npx tsc --noEmit` to catch any caller missing the new required props. Commit the focused E3 change locally by staging `PublicReadiness.tsx`, the eight caller files named above, and the two readiness tests; use `git commit -m "feat: explain public content destinations"`. Do not push yet.

## Task 5: OKR dialog acceptance and Stage 3B gate (D2, F1/F3; F2 remains separate)

**Files:** Browser evidence under `docs/evidence/2026-09-23-stage-3b/`; update `docs/2026-09-22-functional-optimization-todo.md` and `docs/2026-09-22-functional-plan-review.md` only after passing evidence. Change `OkrEntityDialog.tsx` or `admin.module.css` only for a recorded defect.

- [ ] Use a local, disposable database or an already authorized local development instance, never production. For new and edit OKR forms at desktop and 375 px mobile widths, record dialog bounds, available top/bottom space, internal long-form scroll, background scroll lock, focus entry/return, Escape, close, cancel, and backdrop behavior. Save screenshots and short reproduction notes. If a concrete failure appears, follow systematic debugging and add a focused regression check before the smallest fix.
- [ ] In the same browser pass, verify knowledge and resume links, three conversion targets, editor preservation on incomplete conversion responses, unsaved A/B conversion guards, same-page `?activity=A` to `?activity=B` navigation, and E3 copy on representative blocked/ready records. Do not mark a manual check complete if the local data cannot exercise it; record the precise gap.
- [ ] Run the focused Stage 3B tests, then `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run db:validate`, `git diff --check`, and a full migration/seed/`npm run build` against a fresh, exact temporary SQLite file. Remove only verified temporary files after use.
- [ ] Obtain an independent Stage 3B code review. Fix Critical/Important findings and rerun affected checks and the stage suite; update D2–D4, E2–E3 and F1/F3 only where evidence supports completion. Keep F2 unchecked unless this stage also records a separate real Chinese-IME input acceptance pass; OKR dialog checks alone do not satisfy F2.
- [ ] Commit Stage 3B code, tests, evidence, and docs; push `feat/homepage-visual-editor`; verify local and remote SHA match. Do not merge or deploy.
