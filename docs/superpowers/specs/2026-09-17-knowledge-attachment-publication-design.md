# Knowledge Attachment Publication Design

## Goal

Allow a private publication draft to explicitly map Obsidian image embeds to uploaded media, then copy the selected media into an immutable article attachment snapshot when publishing.

## Data Boundary

The existing `Asset` library is mutable: replacement keeps its URL stable and changes its file. A public article must therefore never render an `Asset` URL directly. A draft stores only a private mapping from an Obsidian embed target to an existing asset id. Publication copies the selected file into article-owned storage and creates an immutable attachment record with its own content hash and public id.

`KnowledgePublicationDraftAttachment` contains the draft id, normalized embed target and selected source asset id. `KnowledgeArticleAttachment` contains the article id, embed target, copied storage path, MIME type, size, SHA-256 and public id. Both target mappings are unique per parent record.

## Publishing Flow

1. The administrator uploads a local image through the existing media library if it is not already present.
2. In the private knowledge workspace, every resolvable image embed requires one explicit source-asset selection. Unselected embeds continue to block publishing.
3. Publishing validates that every image embed has exactly one selected asset. It copies each source file to an article-specific immutable storage path before creating the article attachment rows.
4. The article Markdown snapshot rewrites only selected `![[target]]` image embeds to `/api/knowledge/assets/<attachment-id>`. Non-image embeds remain blocked.
5. Public markdown rendering serves the article-owned attachment endpoint; it never reads `Asset`, Vault, source revision or draft data.

## Safety Rules

- Only image assets accepted by the existing media service may be selected.
- The copy path is generated server-side under a dedicated persistent article-attachment directory; request input never supplies a file path.
- Failed publication removes newly copied files and creates no article or attachment rows.
- Existing public article snapshots and attachments are never replaced, deleted or rewritten by later source scans, draft changes or media-library replacement.
- Public attachment serving verifies ownership through an article attachment record and uses its stored MIME type and hash-aware response headers.

## Acceptance Evidence

- An article with an unselected embed cannot publish.
- Replacing the selected source asset after publication does not change the served article attachment bytes.
- A public article response contains only article-owned attachment URLs.
- Private drafts, source asset storage paths and Vault paths never appear in public APIs or page source.
