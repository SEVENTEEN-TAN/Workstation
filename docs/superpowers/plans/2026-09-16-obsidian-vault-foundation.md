# Obsidian Vault Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register local Obsidian vaults and build a safe, read-only Markdown metadata index that can be inspected from the admin workspace.

**Architecture:** Add two Prisma models, a standard-library filesystem scanner, a validated service layer, protected admin APIs, and one route-addressable admin module. A successful scan atomically replaces index metadata; a failed scan preserves the previous index and never mutates the source vault.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6 with SQLite, Zod 4, React 19, Vitest 4, Node filesystem and crypto APIs.

**Spec:** `docs/superpowers/specs/2026-09-16-obsidian-vault-foundation-design.md`

## Global Constraints

- Keep the existing Dark Studio palette and admin interaction patterns unchanged.
- Do not add a Markdown parser, glob library, watcher, queue, or background service.
- Do not store note bodies or attachment bytes.
- Never write, rename, move, or delete files in a registered vault.
- Do not implement publication, backlinks, rendering, incremental sync, or the Windows-side client in this iteration.

---

### Task 1: Vault scanner and validation

**Files:** create `src/lib/knowledge/vault-scanner.ts`, `src/lib/validators/knowledge-vaults.ts`, and `tests/knowledge-vault-scanner.test.ts`.

**Produces:** `scanVault(rootPath, ignorePatterns)` and `knowledgeVaultInputSchema`.

- [x] Write a temporary-directory test covering default and configured ignores, normalized paths, hashes, metadata, and syntax flags.
- [x] Run the focused test and verify the missing scanner failure.
- [x] Implement the minimum recursive scanner with Node standard-library APIs; skip directory symlinks and non-Markdown files.
- [x] Run the focused test and verify it passes.

### Task 2: Persistent vault index service

**Files:** modify `prisma/schema.prisma`; create the migration, `src/lib/services/knowledge-vaults.ts`, and `tests/knowledge-vaults.test.ts`.

**Produces:** `createKnowledgeVaultService(repository?, scanner?)` with `list`, `create`, `update`, `remove`, and `scan`.

- [x] Write service tests for normalized registration, atomic replacement, failed-scan preservation, disabled-vault rejection, and index-only deletion.
- [x] Run the focused test and verify the missing service failure.
- [x] Add the two Prisma models and SQL migration.
- [x] Implement the minimum repository adapter and service orchestration.
- [x] Generate Prisma Client and run the focused tests until green.

### Task 3: Protected APIs and admin workspace

**Files:** create protected vault collection, item, and scan routes; create the admin knowledge page and workspace; modify admin navigation, shared types, styles, and admin contract tests.

- [x] Add failing admin contract assertions for navigation, server page, protected routes, registration fields, scan feedback, confirmation, and note-list empty state.
- [x] Add the protected handlers, page, navigation item, serializable types, and focused client workspace.
- [x] Add only the CSS required for the vault form, summary, and note table.
- [x] Run focused contracts and service tests until green.

### Task 4: Roadmap and full verification

- [x] Mark only vault registration and ignore patterns complete in `docs/product-roadmap.md`.
- [x] Run `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run db:validate`, and `npm run build`.
- [x] Inspect `git diff --check` and `git status --short`.
- [ ] Commit, merge into `main`, push `origin/main`, and remove the feature worktree and branch.
