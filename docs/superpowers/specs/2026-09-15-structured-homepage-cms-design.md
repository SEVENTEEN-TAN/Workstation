# Structured Homepage CMS Design

## Status

Approved for autonomous implementation as iteration V1.2.

## Purpose

Replace the homepage JSON editor with a complete bilingual form while preserving the published homepage contract and every public visual behavior. The editor must make incomplete work visible, protect unsaved changes, and require an explicit preview-and-publish step after restoring historical content.

## Scope

This iteration contains three related capabilities:

1. Structured editing for `meta`, `nav`, `hero`, `about`, `works`, `services`, `footer`, and `projects` in both `zh` and `en`.
2. Draft safety through field and section validation, unsaved-state feedback, leave-page protection, and a publish-readiness summary.
3. Version safety by restoring historical content into the one current draft instead of publishing it immediately.

Media selection and asset reference tracking remain outside V1.2. Image fields continue to accept persisted paths or URLs as text.

## Content Contract

The persisted shape remains the existing `SiteContent` snapshot. No Prisma migration or public component change is allowed. The public site continues to read only one complete `PUBLISHED` snapshot.

The editor exposes one language at a time through a `中文 / English` segmented control. Both language versions remain in the same local draft and are validated together. A section navigation rail shows the number of errors in each section for the active language.

Every scalar field receives a persistent Chinese label. Long-form values use textareas. Tuple headings expose two ordered inputs. Lists and collections support adding, removing, and reordering entries without editing JSON:

- `about.paragraphs`, `about.skills`, and `footer.links` are text lists.
- `about.stats` contains value, accent, and label.
- `services.items` contains title and description.
- `projects` contains image, category, title, description, tags, and alternative text.

Collection deletion must preserve the schema minimum where one exists. Projects may be empty because the current schema permits an empty project list.

## Validation And Draft State

Client validation uses the same Zod `siteContentSchema` as the server. Validation results are normalized into dot paths such as `zh.hero.intro` and section keys such as `zh.hero`. The first message for a path is shown next to its field, while section navigation and the readiness summary show aggregate counts.

The toolbar communicates exactly one of these states:

- `已保存`: local content equals the most recently loaded or saved server draft.
- `有未保存修改`: local content differs from the saved baseline.
- `需要修正 N 项`: the complete bilingual snapshot is invalid.
- An in-progress state supplied by the existing shared action lifecycle.

Saving is available only for a changed, valid snapshot. Publishing is available only for a valid snapshot with no unsaved changes. Preview remains available for the saved draft and warns through the readiness copy when local changes have not been saved.

When the draft is dirty, browser refresh/close and same-origin navigation through links prompt before leaving. Successful save or a server refresh replaces the saved baseline and clears the dirty state. Failed saves keep all local input.

## Version Restoration

The system maintains at most one active `DRAFT` editing target.

Restoring version `vN` follows this transaction:

1. Load and validate the source snapshot.
2. Find the current draft inside the same transaction.
3. If a draft exists, replace its content and keep its stable ID and version number.
4. If no draft exists, create a new `DRAFT` with the next version number and `publishedAt = null`.
5. Do not archive or change the current published version.

The UI action is named `恢复为草稿`. Confirmation explains that unsaved local edits will be replaced and that public content will not change. After success, the restored draft must be previewed and explicitly published through the normal atomic publication flow.

## Layout And Interaction

The existing black, white, and neon-green admin palette remains unchanged. The editor uses a desktop two-column workspace with compact section navigation and a wide form surface. On narrow screens the section navigation becomes a horizontally scrollable control above the form. The action toolbar remains visible near the top of the editor, controls keep a minimum 40px target, labels remain visible, and dynamic content does not resize action buttons.

No public homepage component, CSS class, animation parameter, breakpoint, image ratio, navigation behavior, or copy rendering path may change.

## Feedback And Empty States

- Save, refresh, publish, and restore reuse `useAdminAction` and `FeedbackCenter`.
- Invalid fields show inline messages and are referenced with `aria-describedby`.
- The readiness summary states whether both languages are complete and why publishing is disabled.
- Empty project collections expose one `添加项目` action.
- Collection add/remove/reorder actions use Lucide icons and accessible labels/tooltips.
- Restore confirmation returns focus to its trigger and blocks duplicate submission.

## Testing And Acceptance

- Unit tests cover immutable path updates, dirty comparison, Zod issue mapping, section counts, and collection path handling.
- Service tests prove restore overwrites the current draft when present, creates a draft when absent, and never archives or publishes content.
- UI contract tests prove the JSON textarea and obsolete copy are removed, all eight sections are addressable, both languages are available, dirty protection is installed, and restore language says `恢复为草稿`.
- Existing publishing, public filtering, OKR, authentication, and media tests remain green.
- Browser verification covers editing scalar and collection fields, language switching, inline errors, dirty navigation warning, save, preview, publish, restore, and mobile layout.
- Production build, lint, Prisma validation, and whitespace checks pass.

## Out Of Scope

- Media picker and asset usage tracking.
- Live side-by-side homepage rendering inside the form.
- Changes to public homepage structure or visuals.
- OKR workspace redesign.
- Obsidian, GitHub, timeline, weekly digest, and AI provider integrations.

