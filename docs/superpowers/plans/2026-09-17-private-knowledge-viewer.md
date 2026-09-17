# Private Knowledge Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated, local-only readonly viewer for indexed Obsidian Markdown notes.

**Architecture:** The viewer reads only an already indexed relative Markdown path through a protected service. Filesystem validation lives in one service function; the route contains no path logic and the client only selects known index rows.

**Tech Stack:** Next.js App Router, TypeScript, Node.js filesystem promises, Vitest, existing admin shell.

**Spec:** `docs/superpowers/specs/2026-09-17-knowledge-viewer-publishing-design.md`

## Global Constraints

- Never write to the Obsidian vault.
- Require `withAdminSession` on every note-content route.
- Resolve and validate all paths beneath the registered vault root.
- Do not expose a local absolute path or note body through a public route.
- Render body as escaped source in this iteration; no Markdown execution or Dataview evaluation.

---

### Task 1: Safe Indexed Note Reader

**Files:**
- Create: `src/lib/knowledge/note-reader.ts`
- Test: `tests/knowledge-note-reader.test.ts`

**Interfaces:**
- Produces `readIndexedMarkdownNote(rootPath: string, relativePath: string): Promise<{ content: string }>`.

- [ ] **Step 1: Write a failing traversal test**

```ts
await expect(readIndexedMarkdownNote(root, "../outside.md")).rejects.toThrow("Note unavailable");
```

- [ ] **Step 2: Write a failing valid-note test**

```ts
await expect(readIndexedMarkdownNote(root, "notes/entry.md")).resolves.toEqual({ content: "# Entry" });
```

- [ ] **Step 3: Implement validated UTF-8 reads**

```ts
const vaultRoot = resolve(rootPath);
const candidate = resolve(vaultRoot, relativePath);
if (!candidate.startsWith(`${vaultRoot}${sep}`) || extname(candidate).toLowerCase() !== ".md") throw new Error("Note unavailable");
return { content: await readFile(candidate, "utf8") };
```

- [ ] **Step 4: Run `npm test -- tests/knowledge-note-reader.test.ts`**

- [ ] **Step 5: Commit `feat: add safe local note reader`**

### Task 2: Protected Note-Content API

**Files:**
- Modify: `src/lib/services/knowledge-vaults.ts`
- Create: `src/app/api/admin/knowledge/vaults/[id]/notes/route.ts`
- Test: `tests/knowledge-vaults.test.ts`, `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Produces `knowledgeVaultService.readNote(vaultId, relativePath)`.
- Route returns `{ relativePath, content }` for an indexed note only.

- [ ] **Step 1: Write failing tests for an unknown note and an indexed note**

```ts
await expect(service.readNote("vault-1", "unknown.md")).rejects.toThrow("Note unavailable");
await expect(service.readNote("vault-1", "notes/a.md")).resolves.toMatchObject({ relativePath: "notes/a.md" });
```

- [ ] **Step 2: Add `readNote` using the vault record and indexed paths**

- [ ] **Step 3: Add a `withAdminSession` route that validates `path` query input**

- [ ] **Step 4: Run the focused service and admin contract tests**

- [ ] **Step 5: Commit `feat: add private knowledge note API`**

### Task 3: Admin Note Viewer

**Files:**
- Modify: `src/components/admin/KnowledgeWorkspace.tsx`
- Modify: `src/components/admin/types.ts`
- Modify: `src/app/admin/admin.module.css`
- Test: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Consumes `GET /api/admin/knowledge/vaults/:id/notes?path=<encoded>`.
- Produces an admin-only source panel with note metadata, links, and escaped Markdown text.

- [ ] **Step 1: Write a failing workspace-contract test for the protected note endpoint and source panel**

```ts
expect(workspace).toContain("查看笔记");
expect(workspace).toContain("/notes?path=");
```

- [ ] **Step 2: Add note selection, loading and unavailable states**

- [ ] **Step 3: Render content inside a `pre` element; do not use `dangerouslySetInnerHTML`**

- [ ] **Step 4: Run focused UI-contract tests**

- [ ] **Step 5: Commit `feat: add private knowledge note viewer`**

### Task 4: Full Verification

**Files:** None unless verification exposes a defect.

- [ ] **Step 1: Run `npm test`**
- [ ] **Step 2: Run `npm run lint`**
- [ ] **Step 3: Run `npx tsc --noEmit`**
- [ ] **Step 4: Run `npm run db:validate`**
- [ ] **Step 5: Run `npm run build` with an isolated migrated SQLite database**
- [ ] **Step 6: Commit only required fixes, then push `main`**
