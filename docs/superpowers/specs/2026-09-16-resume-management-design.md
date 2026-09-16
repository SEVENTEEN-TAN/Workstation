# Resume Management And Printable Resume Design

## Purpose

Complete V1.5 career evidence with two related capabilities:

1. The administrator can maintain one Chinese and one English downloadable PDF resume.
2. Visitors can open a bilingual, browser-printable resume assembled from already published career evidence.

The implementation must not restructure the existing homepage or change its established colors, animation, or layout.

## Scope

### Included

- An authenticated `/admin/resume` workspace.
- One current PDF slot per locale: `zh` and `en`.
- Upload, replace, publish/hide, and delete actions for each slot.
- PDF signature, MIME type, extension, and 10 MiB size validation.
- Persistent file storage below `RESUME_UPLOAD_DIR`, falling back to `<UPLOAD_DIR>/resumes` and then `data/uploads/resumes`.
- A public `/resume` page with Chinese/English switching and browser printing.
- Public download endpoints that serve only published resume files.
- Printable content sourced from the published homepage snapshot plus public-ready experience, project, skill, and activity records.

### Excluded

- Resume template builders, drag-and-drop layout editing, DOCX support, PDF generation, file version history, analytics, and per-section inclusion controls.
- Editing structured career evidence from the resume workspace.
- Any homepage recomposition or new homepage navigation item; that remains roadmap item 81.

## Data Model

`ResumeFile` owns the downloadable file metadata:

- `id`: cuid primary key.
- `locale`: unique `ZH` or `EN` slot identifier.
- `originalFilename`, `storagePath`, `mimeType`, `sizeBytes`, `sha256`: immutable metadata for the current file.
- `visibility`: `PRIVATE` or `PUBLIC`, default `PRIVATE`.
- `createdAt`, `updatedAt`.

Replacing a slot keeps its database identity and visibility, writes the new file first, updates the database, then removes the old file. If the database update fails, the new file is removed. If old-file cleanup fails after a successful update, the valid database record remains authoritative.

Deleting a slot removes the database record before removing the file. Missing files return `404`; private files also return `404` from public endpoints so their existence is not disclosed.

## Server Interfaces

`src/lib/services/resume-files.ts` exposes:

- `validateResumePdf(input)` for deterministic file validation.
- `createResumeFileService(repository, removeFile?, storeFile?)` for unit testing lifecycle rules.
- `getResumeFileService()` for Prisma-backed admin operations.
- `saveResumePdf(locale, file)` for first-time slot creation.
- `readPublicResumePdf(locale)` returning the public file metadata or `null`.

Admin routes:

- `GET /api/admin/resume` lists both slots.
- `POST /api/admin/resume` accepts multipart `locale` and `file`; it creates or replaces the selected slot.
- `PATCH /api/admin/resume/:id` accepts JSON `{ visibility }`.
- `DELETE /api/admin/resume/:id` removes the selected slot.

Public route:

- `GET /api/resume/:locale` accepts only `zh` or `en`, serves a public PDF with ETag and a safe download filename, and otherwise returns `404`.

## Admin Experience

`/admin/resume` is a normal route-addressable module in the existing admin shell. It shows two stable locale panels rather than a generic file list. Each panel includes current filename, size, visibility, updated time, and actions appropriate to its state:

- Empty: choose and upload a PDF.
- Existing: replace, toggle public/private, open the public download when public, or delete with `ConfirmDialog`.

All mutations use `useAdminAction`, `FeedbackCenter`, and the existing loading/disabled conventions. Upload controls accept `.pdf,application/pdf` and client copy explains the 10 MiB limit, while the server remains authoritative.

## Public Printable Resume

`/resume` is dynamic and returns `SiteUninitialized` when no published homepage exists. It loads public-ready records through existing services and renders:

- Identity and professional summary from the published homepage snapshot.
- Contact links from the published footer/navigation data.
- Work and education experience.
- Featured projects first, followed by remaining public projects.
- Public capability areas and skills.
- Recent public activities.
- A locale-matched PDF download button only when that public slot exists.

A small client toolbar owns language switching and `window.print()`. Screen styling uses the fixed Dark Studio palette. `@media print` removes the toolbar and dark decoration, switches to black text on white, preserves readable links, and avoids splitting individual resume entries where practical.

The route does not include private records, records rejected by existing public-readiness checks, private PDF metadata, or admin controls.

## Error And Safety Rules

- Accept only `%PDF-` file signatures with MIME `application/pdf` and `.pdf` extension.
- Resolve every stored path beneath the configured resume root before reading or deleting.
- Use random server-side filenames; never trust the uploaded filename as a path.
- Auth-protect every admin route with `withAdminSession`.
- Return public `404` for invalid locales, missing slots, private slots, or missing files.
- Keep database/file replacement ordering consistent with the existing asset service so a failed write cannot destroy the current resume.

## Testing

- Unit tests cover PDF validation, create/replace/delete ordering, rollback cleanup, visibility updates, and public filtering.
- Route/UI contract tests cover admin authentication, navigation registration, both locale panels, upload constraints, confirmations, print action, and the absence of private-data access paths.
- Existing public-service tests continue to prove language completeness and visibility filtering.
- Full `npm test`, `npm run lint`, `npx tsc --noEmit`, Prisma validation, and production build must pass.
- Visual verification covers `/admin/resume` and `/resume` at desktop and mobile widths plus print-preview CSS behavior.

