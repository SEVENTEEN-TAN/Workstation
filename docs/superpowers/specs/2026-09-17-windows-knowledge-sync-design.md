# Windows Knowledge Sync Design

## Goal

Let a Windows-side client scan a local Obsidian Vault and send Markdown snapshots to the deployed WorkStation without granting the server filesystem access to `F:`. The server records the existing incremental sync report and immutable source revisions; it never writes to the Vault, changes a publication draft, or changes a public article.

## Scope

- A small Node/TypeScript client runs on the Windows computer that owns the Vault.
- It reuses the existing Vault scanner and sends Markdown note snapshots, link metadata, and scan time to one private server endpoint.
- The server authenticates the client with one independently configured Bearer token.
- The server uses the current hash/path comparison to create `KnowledgeSyncReport` and `KnowledgeSyncChange` rows, replace the active private index, and append only new source revisions.
- The private note viewer reads the latest stored source revision instead of the server filesystem, so it works after deployment.

## Explicit Non-Goals

- No server-to-Windows connection, filesystem watching, bidirectional editing, attachment transfer, or arbitrary file upload.
- No automatic modification, removal, or replacement of a public article, publication draft, collection, or selected article attachment.
- No multiple sync identities, user roles, or browser-session authentication.

## Authentication

`KNOWLEDGE_SYNC_TOKEN_HASH` is required by the server and contains the SHA-256 hex digest of a high-entropy raw client token. The Windows client reads the raw token only from `KNOWLEDGE_SYNC_TOKEN`; it sends `Authorization: Bearer <token>` over HTTPS. The server hashes the presented value and uses a timing-safe comparison. Invalid, missing, or malformed credentials return a generic `401` response before request data is parsed.

The client configuration also supplies `KNOWLEDGE_SYNC_URL`, `KNOWLEDGE_SYNC_VAULT_ID`, and the local `KNOWLEDGE_SYNC_VAULT_PATH`. These values are local process configuration, never stored by the server response or rendered publicly.

## Transport Contract

The client sends `POST /api/sync/knowledge/vaults/:vaultId` with only:

- `scannedAt`: ISO timestamp.
- `notes`: relative path, name, directory, Markdown content, byte size, modification time, SHA-256, parsed frontmatter, and syntax flags from `scanVault`.
- `links`: the scanner's normalized link and embed metadata.

The payload is JSON and has a conservative total body limit. It rejects unknown fields, absolute paths, parent-directory segments, invalid hashes, duplicate note paths, malformed links, and non-Markdown notes. The endpoint returns a compact report summary only. It never returns source Markdown, Vault root paths, asset locations, draft details, or session information.

## Server Processing

`knowledgeVaultService.receiveTransportSync(vaultId, result)` verifies the Vault is enabled, calculates a report against the current private note index, and executes the same atomic replacement flow as a local scan. New `(vaultId, relativePath, contentHash)` pairs create immutable `KnowledgeSourceRevision` rows with origin `WINDOWS_SYNC`; existing revisions are retained. Missing paths only affect the current index and report; their historical revisions remain available. No publication data is touched.

The transport does not call `readIndexedMarkdownNote`. `readNote` instead selects the newest source revision for the requested indexed relative path. This removes the deployed server's dependency on the local Windows path while retaining the current private-only access control.

## Client Behavior

The client uses the existing `scanVault` implementation, so ignored directories, YAML parsing, wiki-link resolution, embed metadata, and hashes match local behavior. It performs one complete scan per invocation; the server derives additions, edits, moves, missing files, and unchanged files from the prior index. A scheduled Windows Task can invoke the script periodically after the initial manual validation.

The client prints only a report count on success. It never prints the bearer token or full Markdown. Network, authentication, and non-2xx failures keep the local Vault untouched and leave the remote server's prior valid index intact.

## Validation And Tests

- Unit tests cover token verification, payload validation, and rejection of paths outside the Vault format.
- Service tests prove a transport snapshot creates source revisions and reports while preserving published content and drafts.
- Reader tests prove remote note viewing uses source revisions instead of a filesystem root.
- Client tests cover configuration validation and request construction without logging secrets.
- Route tests verify the transport endpoint is not session-authenticated, rejects missing/invalid bearer tokens, and does not expose private source fields.
- Full test suite, lint, TypeScript, Prisma validation, isolated SQLite migration, and production build remain required before merge.
