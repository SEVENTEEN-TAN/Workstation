# Knowledge Viewer And Publishing Design

## Goal

Make private Obsidian notes inspectable in the local admin workspace, then support an explicit, revision-based publication workflow without exposing the vault or changing it from the workstation.

## Constraints

- Obsidian remains the only authoring source. The workstation never writes to the vault.
- A deployed server cannot access the local `F:` drive. Local viewing and server-side publishing must therefore use different content sources.
- Every note and every source revision starts private. No public route reads a vault path.
- Existing link and embed indexes remain metadata only. Attachments are not copied by this feature.
- Markdown rendering must not execute scripts, Dataview, raw HTML, or client-side embeds.

## Scope

### Phase 1: Local Private Viewer

The admin route adds a note selection view. A protected API receives a vault id and an indexed relative path, verifies the vault is enabled and the path belongs to an indexed Markdown note, resolves the path under the registered vault root, and reads UTF-8 text only. Paths outside the root, missing files, and non-Markdown files return a non-sensitive error.

The viewer presents source metadata, parsed properties, outgoing links, backlinks, embeds, and raw Markdown in a private admin-only panel. It displays Markdown as escaped source at first; semantic rendering is a later phase. Dataview blocks remain visible as source and are never evaluated.

### Phase 2: Source Revisions And Publication Drafts

The sync transport provides immutable Markdown source revisions. A selected revision can create a publication draft containing copied Markdown, metadata, and explicitly selected attachment references. A later change to the vault creates a newer source revision; it does not alter an existing public article or draft.

Publication status is separate from note visibility. Only a validated publication draft can become a public article. Public APIs query published article records only, never `KnowledgeVault`, `KnowledgeNote`, local paths, or source revisions.

### Phase 3: Rendered Knowledge Site

Published Markdown uses a server-side, no-HTML Markdown pipeline with GitHub-flavored tables, fenced code, callouts, and task-list presentation. Dataview code fences are rendered as inert source blocks. Embed URLs are emitted only for attachments explicitly copied into the published asset set.

## Data Model

`KnowledgeSourceRevision`: vault/note identity, source hash, Markdown body, parsed frontmatter snapshot, captured timestamp, and transport origin. It is private and append-only.

`KnowledgePublicationDraft`: source revision, title/summary/tags, Markdown snapshot, draft status, selected attachment ids, and timestamps. It is private until explicitly published.

`KnowledgeArticle`: immutable published snapshot, slug, locale-independent metadata, publication timestamp, and visibility. It is the only source consumed by public knowledge routes.

## Security And Error Handling

- The local viewer must use `resolve()` and an exact root-prefix check before every filesystem read.
- Request paths are relative paths selected from the current index, not arbitrary user paths.
- Viewer errors disclose only “note unavailable”; absolute local paths stay server-side.
- The public application must have no import of filesystem access or vault services.
- Failed sync, source read, Markdown parse, or publication validation leaves the last valid source revision and published article unchanged.

## Acceptance Evidence

- An unauthenticated request cannot read any note or source revision.
- A valid indexed local note can be viewed; `../` traversal, symlink escapes, and missing files fail safely.
- The viewer shows metadata and link relationships without writing to the vault.
- A published article remains byte-for-byte unchanged after its source note changes.
- Dataview content is shown as inert text and no script-like content executes.
