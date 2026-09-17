# Knowledge Source Revisions And Drafts Design

## Goal

Capture immutable private Markdown revisions during a local vault scan and allow an administrator to create one private publication draft from a selected revision. A later scan must never change either an existing revision or its draft.

## Scope

This iteration adds only the private source-to-draft boundary. It does not publish articles, serve public knowledge routes, transfer attachments, change a vault file, or provide a Windows sync client.

## Data Model

`KnowledgeSourceRevision` is an append-only private snapshot with the vault id, source relative path, source hash, Markdown body, parsed frontmatter JSON, scan timestamp, and `LOCAL_SCAN` origin. It has a unique constraint on `(vaultId, relativePath, contentHash)`.

The revision does not reference `KnowledgeNote.id`: scan replacement deliberately deletes and recreates indexed note rows, while source revisions must survive rescans, moves, and note deletion review. Vault deletion cascades to its source revisions.

`KnowledgePublicationDraft` has one row per source revision in this iteration. It copies the source hash, Markdown body, title, optional summary, tags, and `DRAFT` status at creation. The unique revision reference makes draft creation idempotent. The draft remains private and has no public visibility field or route.

## Scan And Draft Flow

1. A local scan reads Markdown as it already does for indexing and link analysis.
2. The index transaction stores a source revision only when that path/hash combination has not been captured before.
3. Existing installations have no historical bodies to reconstruct. After migration, the administrator rescans a vault to capture its first revisions.
4. The knowledge workspace shows revisions for the selected note. The administrator may create a private draft from any listed revision.
5. Repeating the request for the same revision returns the existing draft. No source content is re-read during draft creation.

## Metadata Defaults

The draft copies `title`, `summary` or `excerpt`, and scalar `tags` from source frontmatter when available. A missing title falls back to the source filename, so a private draft is always reviewable; public publication validation is a later concern.

## Security Constraints

- Obsidian remains read-only; the workstation never writes to the vault.
- Source revisions and drafts are private database records and every draft endpoint requires `withAdminSession`.
- Public code must not query `KnowledgeVault`, `KnowledgeNote`, `KnowledgeSourceRevision`, or `KnowledgePublicationDraft`.
- A source revision stores a snapshot; its contents are never returned by an unauthenticated route.
- Attachment embeds remain blocked by the existing publication inspector until a later explicit asset-selection workflow exists.

## Acceptance Evidence

- A second scan with unchanged Markdown does not create another source revision.
- A changed source note creates a new immutable revision without changing the previous revision or draft.
- A draft copies Markdown and metadata from its selected revision and is returned on repeated creation requests.
- An unauthenticated draft request is rejected and no public route exposes source or draft content.
- Existing vault scans, private note viewing, and link indexing continue to work.
