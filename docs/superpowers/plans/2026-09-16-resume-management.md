# Resume Management And Printable Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure bilingual PDF resume management and a public browser-printable resume assembled from published career evidence.

**Architecture:** Store one current PDF record per locale in Prisma and keep file bytes in the persistent upload tree. Reuse the existing admin shell, feedback, confirmation, and public-ready career services; render `/resume` from those public sources and expose a tiny client toolbar only for locale selection and printing.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma 6 with SQLite, Zod, Vitest, existing CSS modules and Lucide icons.

**Spec:** `docs/superpowers/specs/2026-09-16-resume-management-design.md`

## Global Constraints

- Preserve the existing homepage structure, Dark Studio colors, animation behavior, and breakpoints.
- Support exactly two resume file slots: `ZH` and `EN`.
- Accept only real PDF files with MIME `application/pdf`, `.pdf` extension, `%PDF-` signature, and size at most 10 MiB.
- Store files below `RESUME_UPLOAD_DIR`, falling back to `<UPLOAD_DIR>/resumes`, then `<cwd>/data/uploads/resumes`.
- Never expose private resume metadata or private career records through public routes or page source.
- Reuse existing admin feedback, confirmation, navigation, and request patterns; add no dependency.
- Follow test-driven development: every production behavior starts with a focused failing test.

---

### Task 1: Resume File Model, Lifecycle Service, And Routes

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260916090000_add_resume_files/migration.sql`
- Create: `src/lib/services/resume-files.ts`
- Create: `src/app/api/admin/resume/route.ts`
- Create: `src/app/api/admin/resume/[id]/route.ts`
- Create: `src/app/api/resume/[locale]/route.ts`
- Create: `tests/resume-files.test.ts`

**Interfaces:**
- Produces `ResumeLocale = "ZH" | "EN"` and `ResumeVisibility = "PRIVATE" | "PUBLIC"`.
- Produces `validateResumePdf(input: { bytes: Uint8Array; mimeType: string; filename: string; maxBytes?: number }): { sha256: string }`.
- Produces `createResumeFileService(repository, removeFile?, storeFile?)` with `list()`, `upload(locale, file)`, `setVisibility(id, visibility)`, `delete(id)`, and `findPublic(locale)`.
- Produces `getResumeFileService()` using Prisma and the configured persistent directory.
- Public route serves bytes only from the result of `findPublic(locale)`.

- [ ] **Step 1: Write failing lifecycle tests**

Create `tests/resume-files.test.ts` with real byte arrays and an in-memory repository. At minimum assert:

```ts
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

expect(validateResumePdf({ bytes: pdf, mimeType: "application/pdf", filename: "resume.pdf" }))
  .toMatchObject({ sha256: expect.stringMatching(/^[a-f0-9]{64}$/) });
expect(() => validateResumePdf({ bytes: new Uint8Array([1, 2, 3]), mimeType: "application/pdf", filename: "resume.pdf" }))
  .toThrow("文件内容不是有效的 PDF");
expect(() => validateResumePdf({ bytes: pdf, mimeType: "text/plain", filename: "resume.pdf" }))
  .toThrow("仅支持 PDF 文件");
expect(() => validateResumePdf({ bytes: pdf, mimeType: "application/pdf", filename: "resume.txt" }))
  .toThrow("文件扩展名必须为 .pdf");
```

Test that first upload creates a private slot, replacement preserves `id` and visibility, database failure removes only the new file, successful replacement removes only the old file, delete removes the record before the file, invalid locale/visibility is rejected, and `findPublic` returns only `PUBLIC` records.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/resume-files.test.ts`

Expected: FAIL because `src/lib/services/resume-files.ts` does not exist.

- [ ] **Step 3: Add the Prisma model and migration**

Add this model:

```prisma
model ResumeFile {
  id               String   @id @default(cuid())
  locale           String   @unique
  originalFilename String   @map("original_filename")
  storagePath      String   @unique @map("storage_path")
  mimeType         String   @map("mime_type")
  sizeBytes        Int      @map("size_bytes")
  sha256           String
  visibility       String   @default("PRIVATE")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@index([visibility, locale])
  @@map("resume_files")
}
```

Create matching SQLite SQL with a unique index for `locale`, a unique index for `storage_path`, and an index for `(visibility, locale)`.

- [ ] **Step 4: Implement the minimal lifecycle service**

Implement path-safe storage and validation without new dependencies. `upload()` must call `storeFile()` before database create/update; on database failure remove the new file and rethrow. After a successful replacement, attempt to remove the old file without invalidating the new record. `delete()` must delete the record first and then remove its file. Normalize external values with:

```ts
export function parseResumeLocale(value: unknown): ResumeLocale {
  if (value !== "ZH" && value !== "EN") throw new Error("简历语言无效");
  return value;
}

export function parseResumeVisibility(value: unknown): ResumeVisibility {
  if (value !== "PRIVATE" && value !== "PUBLIC") throw new Error("简历可见性无效");
  return value;
}
```

- [ ] **Step 5: Verify the focused tests are GREEN**

Run: `npm test -- tests/resume-files.test.ts`

Expected: all resume file tests pass.

- [ ] **Step 6: Add authenticated admin routes and the public download route**

`GET` and multipart `POST` in `/api/admin/resume` must use `withAdminSession`. `PATCH` and `DELETE` in `/api/admin/resume/[id]` must use `withAdminSession` and `jsonError`. The public route must parse `zh|en`, call `findPublic`, revalidate the resolved path against the configured resume root, support ETag/304, set `content-type: application/pdf`, and use a safe ASCII `content-disposition` filename such as `resume-zh.pdf`.

- [ ] **Step 7: Run service and route contract tests**

Run: `npm test -- tests/resume-files.test.ts tests/admin-services.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add prisma src/lib/services/resume-files.ts src/app/api/admin/resume src/app/api/resume tests/resume-files.test.ts
git commit -m "feat: add resume file lifecycle"
```

---

### Task 2: Admin Resume Workspace

**Files:**
- Modify: `src/components/admin/navigation.ts`
- Modify: `src/components/admin/types.ts`
- Modify: `src/app/admin/admin.module.css`
- Create: `src/app/admin/(workspace)/resume/page.tsx`
- Create: `src/components/admin/ResumeFilesWorkspace.tsx`
- Modify: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Consumes Task 1 `getResumeFileService().list()` and admin endpoints.
- Produces route-addressable navigation item `{ id: "resume", href: "/admin/resume", label: "简历管理" }`.
- Produces `ResumeFileData` with string timestamps for client rendering.

- [ ] **Step 1: Write failing admin contract tests**

Extend `tests/admin-ui-contracts.test.ts` to assert:

```ts
expect(ADMIN_NAV_ITEMS.map(({ id }) => id)).toContain("resume");
expect(readProjectFile("src/app/admin/(workspace)/resume/page.tsx")).toContain("ResumeFilesWorkspace");
const workspace = readProjectFile("src/components/admin/ResumeFilesWorkspace.tsx");
expect(workspace).toContain('accept=".pdf,application/pdf"');
expect(workspace).toContain('value="ZH"');
expect(workspace).toContain('value="EN"');
expect(workspace).toContain("ConfirmDialog");
expect(workspace).toContain("FeedbackCenter");
```

Also include `resume` in the server-page parameterized route test.

- [ ] **Step 2: Run the focused UI contract and verify RED**

Run: `npm test -- tests/admin-ui-contracts.test.ts`

Expected: FAIL because the navigation item, route, and workspace do not exist.

- [ ] **Step 3: Add navigation, client type, and server page**

Add `FileText` from Lucide, extend `AdminNavId` with `"resume"`, and place the new navigation item after `skills` and before `media`. Add:

```ts
export type ResumeFileData = {
  id: string;
  locale: "ZH" | "EN";
  originalFilename: string;
  mimeType: "application/pdf";
  sizeBytes: number;
  sha256: string;
  visibility: "PRIVATE" | "PUBLIC";
  createdAt: string;
  updatedAt: string;
};
```

The server page loads the service list and serializes dates before passing `initialFiles`.

- [ ] **Step 4: Implement two stable locale panels**

Use one `<form>` per locale with hidden `locale`, one PDF input, and upload/replace submit action. Render filename, human-readable size, visibility badge, and update time when a slot exists. Toggle visibility with `PATCH`, open `/api/resume/zh` or `/api/resume/en` only when public, and delete only after `ConfirmDialog`. Keep state ordered `ZH`, then `EN`; use `useAdminAction` for every mutation and refresh local state from returned records.

- [ ] **Step 5: Add only the CSS needed for responsive file panels**

Reuse `.panel`, `.sectionHeading`, `.statusBadge`, `.primaryButton`, `.rowActions`, `.iconButton`, and `.spin`. Add a two-column `.resumeFileGrid` that becomes one column below the existing mobile breakpoint, plus `.resumeFileCard`, `.resumeFileMeta`, and `.fileInput` rules. Do not introduce new colors.

- [ ] **Step 6: Verify the focused UI contract is GREEN**

Run: `npm test -- tests/admin-ui-contracts.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add src/components/admin src/app/admin tests/admin-ui-contracts.test.ts
git commit -m "feat: add resume admin workspace"
```

---

### Task 3: Public Printable Resume And Completion Gates

**Files:**
- Create: `src/lib/services/public-resume.ts`
- Create: `src/app/resume/page.tsx`
- Create: `src/app/resume/resume.module.css`
- Create: `src/components/public/PrintableResume.tsx`
- Create: `src/components/public/ResumeToolbar.tsx`
- Create: `tests/public-resume.test.ts`
- Modify: `docs/product-roadmap.md`

**Interfaces:**
- Consumes the published `SiteContent`, `experienceRecordService.listPublic()`, `portfolioProjectService.listPublic()`, `skillCapabilityService.listPublic()`, `careerActivityService.listPublic()`, and Task 1 public resume file slots.
- Produces `getPublicResumeData()` with no private records and ISO string dates safe for client serialization.
- `PrintableResume` accepts one complete data object and owns only presentation; `ResumeToolbar` owns locale state and `window.print()`.

- [ ] **Step 1: Write failing public aggregation and rendering tests**

Create `tests/public-resume.test.ts` with injected sources and assert that the aggregation returns the published site snapshot, only the values returned by public-ready service methods, and only public file availability:

```ts
const data = await createPublicResumeService({
  loadSiteContent: async () => bootstrapSiteContent,
  loadExperiences: async () => [{ id: "experience-public" } as never],
  loadProjects: async () => [{ id: "project-public" } as never],
  loadSkills: async () => [{ id: "skill-public" } as never],
  loadActivities: async () => [{ id: "activity-public" } as never],
  loadResumeFiles: async () => [{ locale: "ZH", visibility: "PUBLIC" } as never],
}).getData();

expect(data?.downloads).toEqual({ zh: true, en: false });
```

Add source contracts asserting the page calls `getPublicResumeData`, the toolbar contains `window.print()`, the stylesheet contains `@media print`, print hides the toolbar, and no admin endpoint is referenced by public components.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/public-resume.test.ts`

Expected: FAIL because the public resume service and components do not exist.

- [ ] **Step 3: Implement the public aggregation service**

Expose:

```ts
export function createPublicResumeService(sources: PublicResumeSources) {
  return { async getData(): Promise<PublicResumeData | null> { /* aggregate public-ready sources */ } };
}

export async function getPublicResumeData(): Promise<PublicResumeData | null>;
```

Load all six sources concurrently. Return `null` when published site content is absent. Convert every `Date` to ISO strings and reduce public file records to `{ zh: boolean; en: boolean }`, never returning filenames, hashes, or paths.

- [ ] **Step 4: Implement `/resume`, toolbar, and printable document**

The server page exports `dynamic = "force-dynamic"`, loads `getPublicResumeData()`, returns `SiteUninitialized` for `null`, and otherwise renders `PrintableResume`. The client component starts with English, hydrates the saved `seventeen-locale` preference, offers a two-option segmented language control, a home link, a print icon button with tooltip/accessible label, and a locale-specific download link only when available.

Render semantic sections in this order: identity/summary, contact, experience, projects, capabilities, recent activities. Use locale-specific fields without mixing languages. Empty sections are omitted rather than replaced by filler copy.

- [ ] **Step 5: Add screen and print CSS**

Use `#0d1116`, `#14181f`, `#00df8f`, white, and existing neutral grays for screen presentation. Keep cards at 8px radius or less. In `@media print`, set white background and black text, hide `.resumeToolbar`, remove shadows/borders that waste ink, show external link URLs where useful, and set `break-inside: avoid` on individual experience/project/skill entries.

- [ ] **Step 6: Verify focused tests are GREEN**

Run: `npm test -- tests/public-resume.test.ts tests/public-experience.test.ts tests/public-projects.test.ts tests/public-skills.test.ts tests/career-activities.test.ts`

Expected: PASS.

- [ ] **Step 7: Mark roadmap item 80 complete and run all gates**

Change only roadmap line 80 from `[ ]` to `[x]`, then run:

```bash
npm test
npm run lint
npx tsc --noEmit
$env:DATABASE_URL="file:./prisma/workstation.db"; npx prisma validate
npm run build
```

Expected: 0 test failures, 0 lint errors, 0 TypeScript errors, valid Prisma schema, and successful Next.js production build.

- [ ] **Step 8: Perform visual and privacy verification**

Run the production server against a migrated disposable database. Verify `/admin/resume` and `/resume` at `1440x1100` and `390x844`; verify print CSS through browser print emulation. Confirm upload, replacement, visibility toggle, download, 304 response, delete confirmation, empty states, success/failure feedback, and that a private PDF returns public `404`. Confirm browser error/warn logs are empty.

- [ ] **Step 9: Commit Task 3**

```bash
git add src/lib/services/public-resume.ts src/app/resume src/components/public tests/public-resume.test.ts docs/product-roadmap.md
git commit -m "feat: add printable public resume"
```

