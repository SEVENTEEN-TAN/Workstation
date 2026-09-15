# Media Library Foundation Design

## Scope

This iteration completes the first usable media-library workflow without changing the public homepage design.

- Search assets by filename or bilingual alternative text.
- Filter assets by image type and alternative-text completeness.
- Show an accessible image preview with metadata.
- Report real upload progress in the browser.
- Edit Chinese and English alternative text after upload.
- Select an uploaded asset from homepage project image fields while preserving manual URL entry.

Reference tracking, guarded deletion, and in-place replacement remain the next media iteration because they require a durable reference model and atomic content updates.

## Architecture

The `Asset` table remains unchanged. The existing authenticated asset collection route keeps list and upload behavior, while `PATCH /api/admin/assets/[id]` updates only bilingual alternative text through a small service-level validator. Search and filtering stay client-side because this is a single-administrator library and the page already receives the complete asset list.

`MediaWorkspace` owns browsing, upload progress, preview selection, and metadata editing. A focused `AssetPicker` component is reused by the homepage editor. The home server page loads assets alongside draft data and passes them through `HomeWorkspace` into `HomepageEditor`; choosing an item writes the stable `/api/assets/{id}` URL into the existing content snapshot, so publishing remains atomic and the public renderer needs no change.

## Interaction

- Upload uses the browser's `XMLHttpRequest.upload.progress` event and exposes a native progress bar and percentage while busy.
- The toolbar contains a search input plus native selects for type and alternative-text state.
- Clicking a media card opens a native modal dialog. The dialog shows the uncropped image, immutable technical metadata, and editable bilingual alternative text.
- Empty search results explain that no asset matches the filters and offer one reset action.
- The homepage project image control keeps its text input and adds a “选择媒体” command. The picker opens only when requested and selecting an asset closes it immediately.
- Keyboard cancellation, focus restoration, busy states, success feedback, and failure feedback follow existing admin patterns.

## Validation And Errors

- Alternative text accepts trimmed strings up to 500 characters; an empty value is stored as `null`.
- The asset id must exist before an update succeeds.
- Authentication remains enforced by `withAdminSession`.
- Upload errors use the same administrator-facing messages as other requests, including login redirection on `401`.

## Acceptance

- Existing assets can be found by filename and either alternative text, and filters combine predictably.
- Upload progress is visible from zero through completion without allowing duplicate submissions.
- Preview and metadata editing work with keyboard and pointer input.
- A selected asset updates only the active language's chosen project image field and marks the homepage draft dirty.
- Manual external or legacy image URLs remain supported.
- Desktop and 390px layouts have no horizontal overflow.
- No public homepage styles, layout, animations, or renderer behavior change.

