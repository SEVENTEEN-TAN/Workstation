# Lazy Obsidian Attachment Transfer

## Goal

Let an administrator request only the image embeds needed by a private knowledge-publication draft. A Windows client then transfers those requested files from the local Obsidian Vault to the server. The public article flow remains unchanged: the administrator still explicitly publishes a draft, and publication creates immutable article-owned snapshots.

## Boundaries

- The server never reads a Windows path or writes to a Vault.
- The Windows client transfers only image files requested for a known draft.
- Raw Vault paths, source revisions, drafts, and upload URLs remain private.
- A sync token authorizes the client; browser admin sessions authorize request creation and inspection.
- Every request is tied to one draft, one source revision, and one Obsidian embed target.
- Existing manually selected media-library assets remain supported.

## Data Model

Add `KnowledgeAttachmentTransferRequest` with a unique `(draftId, target)` pair:

- `id`, `draftId`, `sourceRevisionId`, `target`
- `status`: `PENDING`, `UPLOADED`, `REJECTED`, or `EXPIRED`
- `assetId` after a successful upload
- timestamps and an optional non-sensitive failure reason

The source revision supplies the vault and relative Markdown path. The client receives only the relative note path and embed target, never a server-side filesystem location.

## Flow

1. Creating a publication draft parses image embeds and creates pending transfer requests for unmapped targets.
2. The Windows client posts its Markdown snapshot, then fetches pending requests for that Vault with its bearer token.
3. For each request, the client resolves the embed target inside the configured Vault using the source note's relative directory and the scanner's safe path rules.
4. The client uploads one validated image with the request ID. The server verifies the sync token, the request status, image MIME and byte limits, then stores it through the existing asset writer and maps it to the draft target.
5. The request becomes `UPLOADED`. The administrator can still replace or deselect the asset before publishing.
6. Publishing continues to snapshot selected asset bytes into article-owned immutable storage.

## Failure Handling

- Missing, unsafe, non-image, oversized, or stale requests become `REJECTED`; the original publication draft is unchanged.
- Repeating an upload for an already completed request is idempotent and returns its stored mapping.
- If file storage succeeds but the database mapping fails, remove the newly stored asset file.
- Pending requests expire after a bounded retention period and require a new draft request.

## Tests

- Client path resolution accepts only files beneath the configured Vault.
- Request creation recognizes image embeds and skips already mapped targets.
- Sync endpoints reject bad tokens, unrecognized IDs, stale requests, non-images, and path traversal.
- Successful upload creates one draft attachment mapping without making an article public.
- Existing publish tests prove the resulting asset is still snapshot-owned by the article.
