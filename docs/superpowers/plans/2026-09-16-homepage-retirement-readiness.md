# HomePage Retirement Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that WorkStation is independently installable and deployable, preserves the captured homepage data and media, and matches the captured desktop and mobile appearance without deleting the separate HomePage project.

**Architecture:** Add one repository-level regression test that guards against executable sibling-project dependencies and missing bootstrap media. Document the existing Next.js standalone deployment and rollback flow using only WorkStation-owned files and persistent directories, then record fresh-install and visual comparison evidence in a bounded acceptance report.

**Tech Stack:** Next.js 16, TypeScript 5, Vitest 4, Prisma 6, SQLite, Node.js 22, systemd, Nginx.

**Spec:** `docs/superpowers/specs/2026-09-16-homepage-consolidation-design.md`

## Global Constraints

- Do not modify the public homepage layout, components, CSS, animation parameters, breakpoints, image ratios, navigation behavior, or language behavior.
- Do not delete or archive `C:\Users\23399\Desktop\sqtan\HomePage`; that remains a separately approved destructive action.
- Do not make runtime code depend on ignored migration baselines or files outside the WorkStation repository.
- Keep deployment state in `/opt/personal-workstation` and persistent data in `/var/lib/personal-workstation` and `/var/backups/personal-workstation`.
- Treat server versions, paths, and service state as deployment-time checks rather than confirmed-current production facts.

---

### Task 1: Add The Independence Regression Test

**Files:**
- Create: `tests/homepage-retirement.test.ts`

**Interfaces:**
- Consumes: `bootstrapSiteContent` from `src/lib/content/bootstrap.ts` and repository files under `src`, `tests`, `scripts`, `prisma`, `README.md`, and `docs/deployment.md`
- Produces: a Vitest guard that fails when executable code or deployment documentation references the sibling HomePage source, or when bootstrap `/images/` media is missing

- [ ] **Step 1: Write the failing source-independence test**

```ts
it("has no executable dependency on the sibling HomePage project", async () => {
  const forbidden = ["HomePage/src", "../" + "HomePage", "migrateLegacy" + "SiteContent", "src/data/" + "content.js", "src/data/" + "projects.js"];
  const files = await collectFiles(["src", "tests", "scripts", "prisma", "README.md", "docs/deployment.md"]);
  const matches = files.flatMap(({ path, content }) => forbidden.filter((token) => content.includes(token)).map((token) => `${path}: ${token}`));
  expect(matches).toEqual([]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/homepage-retirement.test.ts`

Expected: FAIL because `tests/homepage-retirement.test.ts` does not exist yet or because `docs/deployment.md` is not present.

- [ ] **Step 3: Add the minimal recursive collector and media assertion**

```ts
it("ships every local image referenced by bootstrap content", async () => {
  const paths = collectImagePaths(bootstrapSiteContent);
  expect(paths.length).toBeGreaterThan(0);
  for (const imagePath of paths) {
    await expect(access(join(process.cwd(), "public", imagePath.replace(/^\//, "")))).resolves.toBeUndefined();
  }
});
```

Use only `node:fs/promises` and `node:path`; exclude the test file itself from the forbidden-reference scan so the assertion tokens are not self-matches.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- tests/homepage-retirement.test.ts`

Expected: PASS after `docs/deployment.md` exists in Task 2.

### Task 2: Document WorkStation-Only Deployment And Rollback

**Files:**
- Create: `docs/deployment.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `next.config.ts`, `.env.example`, `scripts/backup.ts`, `scripts/restore.ts`, committed Prisma migrations, and the verified service layout
- Produces: one operator-facing deployment and rollback guide with no dependency on the independent HomePage project

- [ ] **Step 1: Create the deployment guide**

Document these exact phases:

```text
preflight -> backup -> clean checkout/build -> staged standalone release -> migrate -> atomic service switch -> health checks
rollback -> stop service -> restore prior release -> restore matching database/uploads when schema changed -> start -> health checks
```

Include `/opt/personal-workstation`, `/var/lib/personal-workstation/workstation.db`, `/var/lib/personal-workstation/uploads`, `/var/backups/personal-workstation`, `/etc/personal-workstation.env`, `personal-workstation.service`, `127.0.0.1:3000`, Nginx validation, SQLite integrity checks, and a warning to verify live host state before every deployment.

- [ ] **Step 2: Link the guide from README**

Add one short `## 部署与回滚` section linking `docs/deployment.md`; do not duplicate the operational procedure in README.

- [ ] **Step 3: Run the independence test**

Run: `npm test -- tests/homepage-retirement.test.ts`

Expected: PASS with no forbidden deployment references and all bootstrap media present.

### Task 3: Execute And Record Acceptance

**Files:**
- Create: `docs/homepage-retirement-readiness.md`
- Modify: `docs/product-roadmap.md`

**Interfaces:**
- Consumes: captured baseline under `data/backups/2026-09-15T20-00-22-412Z` from the primary checkout, an ignored temporary SQLite database, and the two captured viewport images
- Produces: evidence for independent migration/seed/test/build/start, content and media comparison, desktop/mobile visual comparison, and the completed roadmap checkbox

- [ ] **Step 1: Verify a WorkStation-only database bootstrap**

Set `DATABASE_URL` to an ignored temporary SQLite file, run `npx prisma migrate deploy`, run `npm run db:seed` twice, and query SQLite to confirm exactly one published `SiteVersion` exists and its content passes `siteContentSchema`.

- [ ] **Step 2: Compare baseline data and assets**

Compare the captured published and draft snapshots, bilingual values, project order, referenced image paths, and SHA-256 hashes of the eight captured public images against the current WorkStation state. Record exact counts and hashes; explain any intentional post-baseline structured-project fields rather than masking them.

- [ ] **Step 3: Run repository verification**

Run: `npm test`, `npm run lint`, `npm run db:validate`, `npx tsc --noEmit`, and `npm run build`.

Expected: every command exits successfully with 24 existing test files plus the new readiness test.

- [ ] **Step 4: Start and visually compare the public homepage**

Start the built application on an unused loopback port with the temporary database. Capture `1440x1100` and `390x844` screenshots, compare them with `homepage-desktop.png` and `homepage-mobile.png`, and inspect both viewports for layout, text, image, navigation, and responsive regressions. Close the browser tabs and service created for this task.

- [ ] **Step 5: Write the acceptance report and close the roadmap item**

Record the commit, environment, commands, database counts, content/media comparison, screenshot dimensions, comparison metrics, observed differences, and remaining boundary that the separate HomePage directory has not been deleted. Only after every check passes, change roadmap item 71 from `[ ]` to `[x]`.

- [ ] **Step 6: Commit and integrate**

Commit the focused files, merge `chore/homepage-retirement-audit` into `main`, push `origin/main`, and remove the completed worktree and branch. Do not remove the independent HomePage directory.
