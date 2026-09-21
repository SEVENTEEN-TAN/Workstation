# Homepage Visual Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let administrators edit approved homepage text, link destinations, portrait, and QR media in an embedded live rendering without changing the existing draft and publishing model.

**Architecture:** Keep `SiteVersion.content` as one bilingual snapshot and add a backward-compatible language-neutral `settings` object. An authenticated same-origin iframe receives the current in-memory snapshot from `HomeWorkspace`; it can emit only allowlisted field updates to the parent. Existing save, validation, preview, publish, history, restore, and media-library flows remain authoritative.

**Tech Stack:** Next.js App Router, React, TypeScript, Zod, Vitest, CSS modules, native iframe and `postMessage`.

**Spec:** `docs/superpowers/specs/2026-09-21-homepage-visual-editor-design.md`

## Global Constraints

- Keep a single validated `SiteVersion.content` snapshot; add no tables, blocks, page-builder framework, dependencies, or remote media URLs.
- Accept only editor-registry paths and plain text; never persist arbitrary DOM, HTML, CSS, or `innerHTML`.
- Preserve public layout, animation, responsive behavior, bilingual behavior, and all existing draft-to-publish boundaries.
- Keep the field editor as an accessible secondary editing path.
- Do not mix this work with the existing uncommitted dialog-centering fix; commit that fix independently before this plan starts.

## Review Focus

- An old published snapshot with no `settings` must render and save with deterministic local defaults.
- A cross-origin, wrong-window, malformed, or unregistered iframe message must not modify draft content.
- A visual edit must update the iframe immediately but must not change saved or public content before the existing save and publish actions.
- A missing, non-image, remote, or deleted media-library asset must be rejected before it can become a saved homepage reference.
- Keyboard users must still reach all editable values when the iframe cannot load or an element cannot be selected visually.

---

### Task 1: Backward-compatible homepage settings and public consumers

**Files:**
- Modify: `src/lib/content/schema.ts`
- Modify: `src/lib/services/site-content.ts`
- Modify: `src/components/public/Hero.tsx`
- Modify: `src/components/public/Footer.tsx`
- Modify: `src/app/admin/(workspace)/layout.tsx`
- Modify: `src/components/admin/AdminShell.tsx`
- Test: `tests/site-content-schema.test.ts`
- Test: `tests/admin-services.test.ts`
- Test: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Produces `SiteContent["settings"]` with `portraitImage`, `wechatQrImage`, `email`, and `githubUrl`.
- Produces `validateHomepageSettingAssets(content)` for draft saving; it accepts local `/images/...` values and verified image-library URLs `/api/assets/{id}`.
- Produces `AdminShell({ username, brandImage, children })`, where `brandImage` is the published portrait or `undefined`.

- [ ] **Step 1: Write failing schema and consumer tests**

```ts
expect(siteContentSchema.parse(legacySnapshot).settings).toEqual({
  portraitImage: "/images/zedian-portrait-v3.png",
  wechatQrImage: "/images/wechat-qr.png",
  email: "m13145215766@163.com",
  githubUrl: "https://github.com/SEVENTEEN-TAN",
});
expect(siteContentSchema.safeParse({ ...legacySnapshot, settings: { ...defaults, portraitImage: "https://example.com/a.png" } }).success).toBe(false);
```

- [ ] **Step 2: Run the new tests and verify they fail because `settings` is absent.**

Run: `npm test -- tests/site-content-schema.test.ts tests/admin-ui-contracts.test.ts`

- [ ] **Step 3: Implement defaults, path validation, and public consumers.**

```ts
const homepageSettingsSchema = z.object({
  portraitImage: localImagePath,
  wechatQrImage: localImagePath,
  email: z.email(),
  githubUrl: z.url().refine((value) => new URL(value).protocol === "https:"),
}).default(DEFAULT_HOMEPAGE_SETTINGS);
```

Resolve the published content in the authenticated admin layout, pass `settings.portraitImage` to `AdminShell`, and retain `17` if it is unavailable. Replace the public hard-coded portrait, QR, email, and GitHub values with `content.settings` values without altering their visible labels.

- [ ] **Step 4: Verify focused tests pass, then commit.**

Run: `npm test -- tests/site-content-schema.test.ts tests/admin-services.test.ts tests/admin-ui-contracts.test.ts`

Commit: `feat: add homepage media and link settings`

### Task 2: Safe visual-editor protocol and iframe route

**Files:**
- Create: `src/components/admin/home/visual-editor-protocol.ts`
- Create: `src/components/public/HomeVisualEditor.tsx`
- Create: `src/app/admin/(workspace)/home/visual-preview/page.tsx`
- Modify: `src/components/public/HomeExperience.tsx`
- Modify: `src/components/public/i18n.tsx`
- Modify: `src/components/public/Hero.tsx`
- Modify: `src/components/public/Footer.tsx`
- Test: `tests/home-visual-editor.test.ts`

**Interfaces:**
- Produces `VISUAL_EDIT_FIELDS`, `isVisualEditField(path)`, and parsed parent/iframe messages.
- `HomeExperience` accepts `editor?: { enabled: boolean }`.
- `HomeVisualEditor` accepts a validated `SiteContent` snapshot and emits only `{ type: "homepage-editor:commit", path, value }`.

- [ ] **Step 1: Write failing protocol tests.**

```ts
expect(isVisualEditField("en.hero.intro")).toBe(true);
expect(isVisualEditField("__proto__.polluted")).toBe(false);
expect(parseIframeMessage({ type: "homepage-editor:commit", path: "settings.portraitImage", value: "<img>" })).toBeNull();
```

- [ ] **Step 2: Run the protocol tests and verify the missing module failure.**

Run: `npm test -- tests/home-visual-editor.test.ts`

- [ ] **Step 3: Implement the narrow protocol and authenticated preview route.**

The route loads the saved draft and renders `HomeExperience` in editor mode. `HomeVisualEditor` verifies `event.origin === window.location.origin`, receives only schema-valid content snapshots from its parent, renders editor-only `data-cms-path` markers, suppresses link navigation while editing, and sends plain `textContent` commits. Put the explicit field list in one registry; do not add dynamic object-path acceptance.

- [ ] **Step 4: Verify focused tests pass, then commit.**

Run: `npm test -- tests/home-visual-editor.test.ts tests/homepage-composition.test.ts`

Commit: `feat: add guarded homepage visual preview`

### Task 3: Parent workspace, live updates, and secondary settings editor

**Files:**
- Modify: `src/components/admin/HomeWorkspace.tsx`
- Modify: `src/components/admin/home/HomepageEditor.tsx`
- Modify: `src/components/admin/home/content-editor.ts`
- Modify: `src/app/admin/admin.module.css`
- Test: `tests/home-content-editor.test.ts`
- Test: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- `HomeWorkspace` supplies the iframe only the current `SiteContent` state and accepts a parsed allowlisted commit.
- `HomepageEditor` exposes settings inputs and reuses `AssetPicker` for portrait and QR selection.
- `updateVisualContent(content, path, value)` returns a new snapshot only for registered paths.

- [ ] **Step 1: Write failing workspace and editor-contract tests.**

```ts
expect(updateVisualContent(content, "zh.hero.intro", "新的介绍").zh.hero.intro).toBe("新的介绍");
expect(updateVisualContent(content, "settings.githubUrl", "https://github.com/SEVENTEEN-TAN").settings.githubUrl).toContain("github.com");
expect(() => updateVisualContent(content, "zh.projects.0.title", "x")).toThrow(/editable/i);
```

- [ ] **Step 2: Run the new tests and verify they fail because visual updates and settings controls do not exist.**

Run: `npm test -- tests/home-content-editor.test.ts tests/admin-ui-contracts.test.ts`

- [ ] **Step 3: Implement the embedded editor view.**

Use a named iframe ref, `postMessage` with `window.location.origin`, and a source-window check. Send the complete current snapshot after iframe readiness and whenever `content` changes. Render desktop/mobile viewport controls, an editor/field-editor switch, and a selected-field panel for link destinations. Reuse `AssetPicker` for images. Preserve all action-bar buttons and the existing saved-version preview.

- [ ] **Step 4: Verify focused tests pass, then commit.**

Run: `npm test -- tests/home-content-editor.test.ts tests/admin-ui-contracts.test.ts tests/home-visual-editor.test.ts`

Commit: `feat: add homepage visual editing workspace`

### Task 4: End-to-end safety and release verification

**Files:**
- Modify: `tests/admin-ui-contracts.test.ts`
- Modify: `tests/home-visual-editor.test.ts`
- Modify: `docs/product-roadmap.md`

**Interfaces:**
- No new production interface; this task proves the preceding interfaces retain draft, publish, media, and accessibility guarantees.

- [ ] **Step 1: Write failing regression coverage for the five Review Focus cases.**

```ts
expect(parentAcceptsMessage({ origin: "https://other.example", source: foreignWindow, data: validCommit })).toBe(false);
expect(resolveVisualMedia("/api/assets/missing", assets)).toEqual({ ok: false, field: "settings.portraitImage" });
```

- [ ] **Step 2: Run the regression tests and verify they fail on the missing guard.**

Run: `npm test -- tests/home-visual-editor.test.ts tests/admin-services.test.ts`

- [ ] **Step 3: Add only the missing guards and mark the completed roadmap item.**

Ensure a failed iframe load leaves the field editor and saved preview usable. Add the visual-editor completion entry under the existing homepage consolidation section; do not add a new product initiative.

- [ ] **Step 4: Run release verification, capture desktop/mobile editor screenshots, then commit.**

Run: `npm test && npm run lint && npm run db:validate && npm run build && git diff --check`

Commit: `test: verify homepage visual editor safety`

## Plan Self-Review

- Spec coverage: Tasks 1–3 cover settings, shared portrait, embedded rendering, allowlisted editing, messages, media selection, secondary editor, and retained publication semantics. Task 4 covers error handling, accessibility fallback, and full verification.
- Placeholders: none; each production task names its files, interfaces, failing test, command, implementation boundary, and commit.
- Type consistency: all child-to-parent updates use registry path strings; only `updateVisualContent` writes them into `SiteContent`.
- Review Focus: each listed failure mode has explicit coverage in Tasks 1–4.
