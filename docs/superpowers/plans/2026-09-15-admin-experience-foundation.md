# Admin Experience Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a branded, route-addressable and reliably responsive administration foundation without changing public pages or existing business behavior.

**Architecture:** Server-rendered admin routes load their own initial data beneath one authenticated layout. Focused client modules preserve the current CMS, OKR, dashboard and media operations, while shared navigation, request, feedback and confirmation primitives keep interaction behavior consistent.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS Modules, Lucide React, Vitest 4, Prisma 6 and SQLite.

**Spec:** `docs/superpowers/specs/2026-09-15-admin-experience-foundation-design.md`

## Global Constraints

- Keep the existing Dark Studio black, white and neon-green palette unchanged.
- Do not change the public homepage, public OKR, API routes, Prisma schema, persisted data, OKR calculations or authentication rules.
- Preserve the existing homepage JSON editor and current OKR CRUD behavior in V1.1.
- Use existing dependencies only.
- Keep every interactive target at least 40 by 40 CSS pixels and preserve visible keyboard focus.
- Verify responsive behavior at 390, 768, 900, 1024 and 1440 CSS pixels.

---

### Task 1: Establish Version-Control Baseline

**Files:**
- Modify: `.gitignore`
- Track: all current source, tests, documentation and configuration files not already ignored

**Interfaces:**
- Consumes: GitHub repository `SEVENTEEN-TAN/Workstation`, whose `main` branch contains only the initial README commit.
- Produces: a local imported baseline with the remote commit retained in ancestry, plus an isolated `feature/admin-experience-foundation` worktree.

- [ ] **Step 1: Initialize Git and fetch the remote without checking out over local files**

Run:

```powershell
git init -b import/current-state
git remote add origin https://github.com/SEVENTEEN-TAN/Workstation.git
git fetch origin main
```

Expected: the local files remain unchanged and `origin/main` resolves to the existing initial commit.

- [ ] **Step 2: Ensure local worktrees are ignored**

Add this exact entry to `.gitignore`:

```gitignore
/.worktrees/
```

- [ ] **Step 3: Commit the current local project as an import baseline**

Run:

```powershell
git add -A
git commit -m "chore: import personal workstation baseline"
git merge origin/main --allow-unrelated-histories -m "chore: connect GitHub repository history"
```

Resolve the README merge by keeping the complete local README. Expected: both the remote initial commit and local import commit are ancestors of `HEAD`.

- [ ] **Step 4: Create the isolated implementation worktree**

Run:

```powershell
git worktree add .worktrees/admin-experience-foundation -b feature/admin-experience-foundation
npm install
npm test
```

Expected: 31 baseline tests pass in the new worktree.

- [ ] **Step 5: Record the baseline**

Commit any merge-resolution-only change with:

```powershell
git add README.md .gitignore
git commit -m "chore: prepare admin experience worktree"
```

Skip this commit when the worktree is already clean.

---

### Task 2: Add Shared Admin State And Navigation Contracts

**Files:**
- Create: `src/components/admin/navigation.ts`
- Create: `src/components/admin/request.ts`
- Create: `src/components/admin/useAdminAction.ts`
- Create: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Produces: `ADMIN_NAV_ITEMS`, `resolveAdminNavItem(pathname)`, `sanitizeAdminReturnPath(value)`, `adminRequest<T>(path, init)`, `AdminRequestError`, and `useAdminAction()`.
- `useAdminAction()` returns `{ feedback, dismissFeedback, isBusy, runAction }`; `runAction(key, work, successMessage)` ignores a duplicate key while its first operation is active.

- [ ] **Step 1: Write failing contract tests**

Add tests that assert:

```typescript
expect(resolveAdminNavItem("/admin/okr")?.id).toBe("okr");
expect(resolveAdminNavItem("/admin/okr/cycles/c1")?.id).toBe("okr");
expect(resolveAdminNavItem("/admin/unknown")).toBeUndefined();
expect(sanitizeAdminReturnPath("/admin/media?filter=png")).toBe("/admin/media?filter=png");
expect(sanitizeAdminReturnPath("/admin/login")).toBe("/admin/overview");
expect(sanitizeAdminReturnPath("https://example.com")).toBe("/admin/overview");
expect(createFeedback("success", "草稿已保存").role).toBe("status");
expect(createFeedback("error", "请求失败").role).toBe("alert");
```

- [ ] **Step 2: Run the focused test and verify the expected red state**

Run: `npm test -- tests/admin-ui-contracts.test.ts`

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement the minimal contracts**

Use exact navigation routes `/admin/overview`, `/admin/home`, `/admin/okr`, and `/admin/media`. The return-path sanitizer must accept only paths beginning with `/admin/`, reject login/setup, and reject protocol-relative or absolute URLs. `adminRequest` must parse JSON when available, throw a typed error containing issue paths, and redirect a browser-side `401` to `/admin/login?next=<current admin path>`.

- [ ] **Step 4: Run focused and full tests**

Run:

```powershell
npm test -- tests/admin-ui-contracts.test.ts
npm test
```

Expected: all contract tests and all 31 existing tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/components/admin tests/admin-ui-contracts.test.ts
git commit -m "feat: add admin interaction contracts"
```

---

### Task 3: Build The Authenticated Admin Shell And Route Modules

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/loading.tsx`
- Create: `src/app/admin/error.tsx`
- Create: `src/app/admin/overview/page.tsx`
- Create: `src/app/admin/home/page.tsx`
- Create: `src/app/admin/okr/page.tsx`
- Create: `src/app/admin/media/page.tsx`
- Create: `src/components/admin/AdminShell.tsx`
- Create: `src/components/admin/PageHeader.tsx`
- Create: `src/components/admin/FeedbackCenter.tsx`
- Create: `src/components/admin/EmptyState.tsx`
- Create: `src/components/admin/ConfirmDialog.tsx`
- Create: `src/components/admin/OverviewWorkspace.tsx`
- Create: `src/components/admin/HomeWorkspace.tsx`
- Create: `src/components/admin/OkrWorkspace.tsx`
- Create: `src/components/admin/MediaWorkspace.tsx`
- Create: `src/components/admin/types.ts`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/admin/admin.module.css`
- Delete: `src/app/admin/AdminWorkspace.tsx`
- Test: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Consumes: the Task 2 navigation, request and action contracts plus all existing admin APIs.
- Produces: route-preserving admin modules in one server-guarded shell. Each server page serializes only its own initial data and passes it to the matching client workspace.

- [ ] **Step 1: Add failing shell-markup and route-contract tests**

Use `react-dom/server` to assert that the shared empty state exposes one relevant action and that page header markup contains the supplied title and optional description. Add source-route assertions for `/admin` redirecting to `/admin/overview` and for all four module page files.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/admin-ui-contracts.test.ts`

Expected: FAIL because the shell and route modules are absent.

- [ ] **Step 3: Implement the shared shell**

`src/app/admin/layout.tsx` must call `currentSession()` once and redirect unauthenticated users to `/admin/login`. `AdminShell` must use `usePathname()` for active navigation, render `aria-current="page"`, provide a 40px menu button below 1024px, close the menu after route selection, and preserve the current UI when logout fails.

- [ ] **Step 4: Implement reusable feedback, empty, loading and confirmation UI**

`FeedbackCenter` must render success as `role="status"`, error as `role="alert"`, and expose dismissal. `ConfirmDialog` must use the native modal dialog contract or an equivalent focus-trapped implementation, name the target record, describe related-data impact, return focus to its trigger and disable confirmation while busy. `loading.tsx` and `error.tsx` must fill a stable workspace region; the error state exposes one retry action.

- [ ] **Step 5: Move existing behavior into route modules**

Move dashboard refresh to `OverviewWorkspace`, draft/version operations to `HomeWorkspace`, all current cycle/Objective/KR/progress/review operations to `OkrWorkspace`, and upload/list operations to `MediaWorkspace`. Replace `window.confirm` with `ConfirmDialog`; retain the JSON prompt editor until V1.3. Use action keys so duplicate requests are ignored and each initiating control shows a busy state.

- [ ] **Step 6: Implement responsive CSS without changing palette values**

At 1024px and above use a 248px left rail. Below 1024px use a sticky top bar and toggled navigation panel. Ensure forms use responsive grids instead of squeezed flex rows, the workspace never overflows horizontally, focus rings remain visible, and reduced-motion preferences suppress transitions.

- [ ] **Step 7: Run focused and full verification**

Run:

```powershell
npm test -- tests/admin-ui-contracts.test.ts
npm test
npm run lint
npm run build
```

Expected: tests, lint and production build all pass; API and public-page source files remain unchanged.

- [ ] **Step 8: Commit**

```powershell
git add src/app/admin src/components/admin tests/admin-ui-contracts.test.ts
git commit -m "feat: add route-addressable admin workspace"
```

---

### Task 4: Rebuild Login And Setup Entry Experience

**Files:**
- Create: `src/components/admin/AuthFrame.tsx`
- Modify: `src/app/admin/login/page.tsx`
- Modify: `src/app/admin/login/LoginForm.tsx`
- Modify: `src/app/admin/setup/page.tsx`
- Modify: `src/app/admin/setup/SetupForm.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `src/proxy.ts`
- Test: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Consumes: `sanitizeAdminReturnPath` from Task 2.
- Produces: branded two-region authentication pages and return-path-aware login. `LoginForm` accepts `{ nextPath: string }` and redirects there on success.

- [ ] **Step 1: Write failing login behavior tests**

Add assertions that `getLoginErrorMessage(429)` returns the throttling message, all other failed credential statuses return the same generic credential message, and the proxy source includes both pathname and query string when building `next`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- tests/admin-ui-contracts.test.ts`

Expected: FAIL because the login helpers and query-preserving proxy behavior are absent.

- [ ] **Step 3: Implement the shared authentication frame**

Wide screens use an identity region with `SEVENTEEN / PERSONAL WORKSTATION`, `PRIVATE CONTROL.`, a concise product description and the existing Java + AI engineering identity. Compact screens show the same identity as a concise header above the form. Reuse this frame for first-administrator setup.

- [ ] **Step 4: Implement login and setup interaction details**

Add persistent labels, password visibility controls with Lucide icons, stable submit-button dimensions, `aria-busy`, inline `role="alert"`, keyboard submission and disabled controls while submitting. Preserve the current generic credential error and throttling message. Successful login uses the sanitized `next` path, otherwise `/admin/overview`.

- [ ] **Step 5: Run focused and full verification**

Run:

```powershell
npm test -- tests/admin-ui-contracts.test.ts
npm test
npm run lint
npm run build
```

Expected: all commands pass and the existing authentication API remains unchanged.

- [ ] **Step 6: Commit**

```powershell
git add src/app/admin src/components/admin/AuthFrame.tsx src/proxy.ts tests/admin-ui-contracts.test.ts
git commit -m "feat: polish administrator entry flow"
```

---

### Task 5: Visual Verification, Roadmap And GitHub Delivery

**Files:**
- Modify: `docs/product-roadmap.md`
- Create: `.superpowers/sdd/2026-09-15-admin-experience-foundation/progress.md` (git-ignored execution ledger)

**Interfaces:**
- Consumes: completed Tasks 1-4.
- Produces: current verification evidence, completed V1.1 roadmap state, and a pushed GitHub feature branch.

- [ ] **Step 1: Seed or verify the local test administrator**

Run `npm run db:seed`. Expected: local credentials `admin / admin` are available; production setup continues to require at least 12 characters.

- [ ] **Step 2: Start the development server**

Run `npm run dev` on an available localhost port and keep the process running through visual verification.

- [ ] **Step 3: Verify browser flows**

At 390, 768, 900, 1024 and 1440 CSS pixels, verify login, password visibility, navigation, direct-route refresh, browser back, all refresh actions, logout, empty state and destructive confirmation. Confirm no horizontal overflow or overlapping controls.

- [ ] **Step 4: Verify the public baseline**

Capture `/` and `/okr` at desktop and mobile sizes. Compare structure, palette, navigation, animation availability and image rendering against the pre-iteration pages; no public component or stylesheet change is allowed in this iteration.

- [ ] **Step 5: Run final automated checks**

Run:

```powershell
npm test
npm run lint
npm run db:validate
npm run build
git diff --check
git status --short
```

Expected: 0 test failures, 0 lint errors, valid Prisma schema, successful production build, no whitespace errors, and only intended source/document changes before commit.

- [ ] **Step 6: Request final code review and resolve Critical or Important findings**

Review the complete branch diff against the specification, rerun the focused checks for every fix, and then rerun Step 5.

- [ ] **Step 7: Mark V1.1 roadmap items complete and commit**

Update only the six V1.1 checkboxes in `docs/product-roadmap.md`, then run:

```powershell
git add docs/product-roadmap.md
git commit -m "docs: complete admin experience foundation roadmap"
```

- [ ] **Step 8: Push the feature branch**

Run:

```powershell
git push -u origin feature/admin-experience-foundation
```

Expected: GitHub contains the full imported project and V1.1 commits without rewriting `origin/main`.
