# Homepage Visual Editor Design

## Status

Ready for user review on 2026-09-21. This document changes no business behavior by itself.

## Goal

Replace the form-first primary workspace in `/admin/home` with an embedded rendering of the real public homepage that supports controlled in-place editing of homepage text, link labels and destinations, the portrait, and the WeChat QR image. Preserve the existing bilingual `SiteVersion.content` snapshot, validation, draft save, authenticated preview, publish, version history, and rollback behavior.

The first release applies only to the homepage CMS. It does not turn the other admin modules into visual editors.

## Confirmed User Outcomes

- The admin sidebar brand mark uses the same published portrait as the public hero card, with `17` as its fallback.
- The homepage editor renders the actual public components inside the admin workspace instead of requiring a separate window for routine editing.
- Administrators can select visible text and images on the rendered page and edit only fields explicitly supported by the homepage content model.
- Unsaved edits appear immediately in the embedded preview but do not affect the saved draft or public page until the existing save and publish actions are used.
- Chinese and English remain separate values in one bilingual snapshot.

## Current State

- `HomeWorkspace` owns the current draft content, saved content, dirty state, validation, save, publish, and rollback operations.
- `HomepageEditor` updates immutable content paths through `updateContentAtPath` and displays paired Chinese and English fields.
- `/preview?id=...` renders `HomeExperience` from a saved database version, so it cannot show unsaved edits.
- Public homepage components consume `SiteContent` through `I18nProvider`, but their rendered elements do not identify the source content paths.
- The hero portrait, contact email, GitHub URL, and WeChat QR image are hard-coded in public components.
- The existing media picker returns an asset record; current callers turn its ID into a local `/api/assets/{id}` reference, and asset reference protection already recognizes those paths inside `SiteVersion` snapshots.

## Constraints

- Keep one validated `SiteVersion.content` JSON snapshot. Do not create section tables, blocks, a generic page builder, or a second persistence path.
- Reuse `HomeExperience`, its public components, `AssetPicker`, `updateContentAtPath`, `siteContentSchema`, and the existing save and publish services.
- Preserve the public homepage layout, styling, animations, responsive behavior, content order, and bilingual behavior outside explicit content edits.
- Do not persist HTML or arbitrary DOM mutations. Text edits persist as plain strings at approved content paths.
- Do not allow the embedded page to bypass authentication, validation, dirty-state warnings, or the draft/publish boundary.
- Homepage media must remain local paths or media-library asset paths; the visual editor does not introduce remote image URLs.
- Existing saved and published snapshots must continue to parse without a manual database migration.

## Content Model

Add one language-neutral `settings` object to `SiteContent`:

```ts
type HomepageSettings = {
  portraitImage: string;
  wechatQrImage: string;
  email: string;
  githubUrl: string;
};
```

The schema supplies defaults when older snapshots do not contain `settings`:

- `portraitImage`: `/images/zedian-portrait-v3.png`
- `wechatQrImage`: `/images/wechat-qr.png`
- `email`: the currently published contact email
- `githubUrl`: the currently published GitHub profile URL

This keeps media and destinations out of the duplicated `zh` and `en` objects. Existing localized fields continue to own visible link labels such as `footer.github`, `footer.wechat`, and `footer.links`.

Image values accept existing local `/images/...` paths and `/api/assets/{id}` paths selected through the media library. They do not accept arbitrary remote URLs. The email and GitHub URL receive focused format validation in `siteContentSchema`.

## Recommended Architecture

### 1. Embedded Same-Origin Preview

Add an authenticated, same-origin homepage editor-preview route. It initially renders the saved draft so refresh and direct access have a deterministic state. After the iframe loads, `HomeWorkspace` sends the current in-memory `SiteContent`; every subsequent edit sends the updated snapshot so unsaved changes render immediately.

The iframe isolates public-page CSS and responsive layout from admin CSS. The parent workspace provides desktop and mobile viewport controls. The existing separate authenticated preview remains available as the final saved-draft check before publishing.

### 2. Explicit Editable-Field Markers

Public homepage components gain editor-only markers for approved fields, for example:

```text
zh.hero.intro
en.works.heading
zh.footer.github
settings.email
settings.githubUrl
settings.portraitImage
settings.wechatQrImage
```

Markers are present only in editor mode and have no visual or behavioral effect on the public page. A small shared registry defines the approved path, editor type (`text`, `link`, or `image`), and label. This registry is the security and product boundary; the iframe cannot request updates to paths that are not registered.

Visible headings, paragraphs, button labels, and link labels can be edited in place as plain text. Link destinations use a focused editor panel because their value is not visible page text. Image selection opens the existing `AssetPicker` in the parent admin page.

### 3. Narrow Message Protocol

The parent and iframe communicate with a discriminated `postMessage` protocol:

- parent to iframe: current content, active viewport, and selection acknowledgement;
- iframe to parent: ready, select approved field, and commit plain-text value.

Both sides verify `event.origin`, the expected `window` source, message type, and payload shape. The parent converts a string path only after finding it in the approved registry, applies the update with `updateContentAtPath`, and re-runs the existing full-schema validation. It never accepts an arbitrary path or HTML payload from the iframe.

### 4. Editing Behavior

- Hovering an editable element shows a subtle outline and its field label.
- Clicking text selects it and enables controlled plain-text editing. Committing sends `textContent`, never `innerHTML`.
- Clicking a link while editor mode is active selects it instead of navigating. Its label can be edited in place; supported destinations are edited in the parent panel.
- Clicking the portrait or QR image opens the media picker. Selecting an asset updates the corresponding `settings` path.
- The homepage language switch remains usable and changes which localized paths are selected.
- Section scrolling remains usable. External navigation and form submission are disabled inside editor mode so an accidental click cannot leave the editing context.
- The existing form editor remains available as a secondary “字段编辑” view for accessibility labels, advanced copy, collections, project selection/order, and recovery when a field is difficult to select visually.
- The secondary field editor also exposes the four language-neutral settings, using text inputs for destinations and the same media picker for images.

## Admin Sidebar Portrait

The authenticated admin layout resolves the latest published homepage portrait and passes it to `AdminShell`. The sidebar and mobile brand marks display a small, cropped version of that image and fall back to `17` when no valid image is available.

The sidebar follows the published value, not the unsaved draft. This avoids changing global admin chrome while an unpublished homepage edit is still being evaluated. The browser may request the same media endpoint at a small rendered size; generating a separate thumbnail is deferred unless measured transfer cost requires it.

## Data Flow

1. The admin route loads the current draft and media-library assets as it does today.
2. `HomeWorkspace` parses the draft with schema defaults and owns the working `content` state.
3. The iframe loads the authenticated visual-preview route and announces readiness.
4. `HomeWorkspace` sends its current content to the iframe.
5. The administrator selects an approved element and edits text, a destination, or an image.
6. The parent validates the message and approved path, updates its immutable content state, and sends the resulting snapshot back to the iframe.
7. Existing dirty-state and readiness summaries update from the same content state.
8. “保存草稿” uses the existing draft API and service validation.
9. The existing separate preview verifies the saved version; “发布” keeps its current requirement that the draft is valid and has no unsaved edits.

## Validation And Error Handling

- Schema defaults make historical snapshots compatible and materialize the new settings when a draft is next saved.
- Invalid messages, unknown paths, wrong origins, and wrong iframe sources are ignored and reported through the existing admin feedback area without changing content.
- Invalid user values remain visible as unsaved edits and use the existing readiness and field-error system; they cannot be saved or published.
- If the embedded preview fails to load, the field editor and separate saved-draft preview remain usable.
- Draft saving verifies that `/api/assets/{id}` settings still reference existing image assets. A missing asset leaves the draft unsaved and reports the field that must be replaced.
- The unsaved-change warning continues to protect refresh and navigation.

## Accessibility

- Visual selection is not the only editing method; every field remains reachable through the secondary field editor.
- Editor outlines are not color-only and do not replace visible keyboard focus.
- Editable elements are keyboard-selectable in editor mode, and the parent panel restores focus after media selection or cancellation.
- Image alternative text remains a paired bilingual field and is not inferred from the image filename.
- Editor-only labels and controls do not appear in the public accessibility tree.

## Verification Strategy

- Schema tests prove old snapshots receive settings defaults and invalid email, GitHub, or remote image values are rejected.
- Service tests prove draft saving rejects missing or non-image media-library references.
- Unit tests prove only registered visual-edit paths can update content, including protection against prototype-pollution paths and malformed messages.
- Component tests prove the same portrait setting drives the public hero and the published admin brand fallback behavior.
- UI contract tests cover editor-only markers, plain-text commits, link interception, image selection, language switching, and keyboard selection.
- Workspace tests prove unsaved edits update the iframe but not the saved draft; save, separate preview, publish, history, and rollback retain their current semantics.
- Manual desktop and mobile checks compare the public page with the existing visual baseline and confirm that editor mode does not leak into public rendering.
- Run the focused tests, full test suite, lint, production build, Prisma validation, and `git diff --check` before completion.

## Delivery Sequence

1. Extend `SiteContent` with backward-compatible language-neutral settings and update the public hard-coded portrait, QR, email, and GitHub values.
2. Make the admin brand consume the published portrait with the `17` fallback.
3. Add the authenticated embedded preview and live parent-to-iframe content updates.
4. Add the approved field registry and text selection/editing.
5. Add link-destination and media-picker editing.
6. Preserve the field editor as the secondary path and complete automated and visual verification.

Each step must leave the existing save and publish path working. Do not combine this work with public navigation changes, knowledge-base discoverability, or draft-module renaming.

## Out Of Scope

- Visual editing for OKR, activities, weekly updates, milestone drafts, timeline drafts, projects, experience, skills, resume, knowledge, AI, GitHub sync, or media administration.
- Arbitrary HTML, CSS, layout, animation, component, or section-order editing.
- Drag-and-drop page building, reusable blocks, plugins, collaboration, comments, approvals, autosave, or undo history beyond existing version history.
- Editing the destinations of semantic homepage section-scroll controls.
- Public navigation changes, including adding the knowledge-base entry.
- Generating dedicated image thumbnails unless performance measurement shows the shared media request is unsuitable.
- Deleting or archiving the independent HomePage project.
