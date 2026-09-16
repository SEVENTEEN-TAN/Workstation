# Obsidian Vault Foundation Design

## Purpose

Add the first read-only bridge between the personal workstation and local Obsidian vaults. Obsidian remains the authoring source. The workstation stores only vault configuration and note index metadata so the administrator can inspect what exists before any publishing workflow is introduced.

The first registered vault is the existing personal technology vault on the local `F:` drive. It currently contains 439 Markdown files across up to seven directory levels. Frontmatter, wikilinks, and embeds are common, so the index records format capability flags from the start without storing note bodies.

## Scope

This iteration provides:

- one or more registered local vaults;
- default ignores for `.obsidian`, `.trash`, `.claudian`, and `.workbuddy`;
- additional administrator-defined ignore patterns;
- an explicit, manual, read-only full scan;
- one indexed record per Markdown file with relative path, name, directory, size, modification time, content hash, and Obsidian syntax flags;
- scan summaries and a searchable admin file list.

This iteration does not provide background watching, server-to-Windows communication, attachment transfer, note-body storage, Markdown rendering, link graph construction, publication, deletion propagation, or writes back to the vault.

## Architecture

The feature follows the existing service and admin-module patterns.

- `KnowledgeVault` stores a stable vault identity, local absolute path, enabled state, ignore patterns, last scan status, and last scan summary.
- `KnowledgeNote` stores index metadata only. Its unique identity is the pair of vault ID and normalized relative path.
- A filesystem scanner accepts a root path and ignore patterns, walks with Node standard-library APIs, reads Markdown only to calculate SHA-256 and detect syntax features, and returns a complete in-memory scan result.
- The service validates that the root exists and is a directory, runs the scanner, and replaces that vault's note index in one transaction. The source vault is never mutated.
- Admin routes require the existing single-admin session guard. The UI initiates registration and manual scans and displays status, counts, errors, and indexed paths.

No new runtime dependency is needed. Full Markdown parsing belongs to the later compatibility iteration.

## Data Model

`KnowledgeVault` stores `name`, unique `rootPath`, `enabled`, JSON `ignorePatterns`, scan status, scan timestamp, file count, safe error text, and timestamps.

`KnowledgeNote` stores the parent vault, unique normalized relative path, file and directory names, size, source modification time, SHA-256, scan timestamp, and booleans for frontmatter, wikilinks, embeds, callouts, Dataview, and tasks.

Deleting a registered vault deletes only workstation index rows. It never deletes local files.

## Ignore Semantics

The four default directories are always excluded. Configured patterns are matched against normalized relative paths:

- a plain segment such as `private` excludes that directory or file name at any level;
- a path prefix such as `archive/drafts` excludes that subtree;
- a suffix glob such as `*.excalidraw.md` excludes matching file names.

The initial implementation intentionally supports only these three predictable forms. A full glob engine is unnecessary for the current vault and would add a dependency.

## Scan Safety

- A scan checks the root path before traversal.
- The scanner never calls write, rename, move, or delete operations under the vault.
- Symlinked directories are not traversed, preventing escape from the registered root and traversal cycles.
- Hidden directories are allowed unless they match an ignore rule.
- A failed scan preserves the previous successful note index and records a safe error state.
- A successful scan replaces the previous index atomically.

## Admin Experience

Add a Knowledge module to the existing admin navigation at `/admin/knowledge`. The page contains a compact registration form, summary metrics, one panel per vault, manual scan controls, and a searchable note table. It reuses the existing loading, confirmation, feedback, and empty-state patterns. Public routes are unchanged.

## Testing

- Scanner tests use a temporary vault and prove ignore behavior, path normalization, syntax flags, hash changes, and read-only operation.
- Service tests prove validation, atomic replacement, failed-scan preservation, and vault deletion semantics.
- Admin contract tests prove navigation, protected API routes, required form fields, feedback, confirmation, and empty states.
- Prisma validation, migrations, TypeScript, lint, full Vitest, and production build are required before merge.

## Future Boundary

The next V2 iteration may compare scans for additions, edits, moves, and possible deletions, then introduce a Windows-side sync client. It must build on stored hashes and relative paths rather than changing this iteration into a background watcher.
