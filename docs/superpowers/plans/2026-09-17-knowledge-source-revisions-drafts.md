# Knowledge Source Revisions And Drafts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture immutable, private source revisions from local scans and create private publication drafts from selected revisions.

**Architecture:** The scanner carries already-read Markdown through the index transaction, which appends a revision only for a new path/hash pair. Revisions are independent of replaceable index rows. A dedicated draft service copies a revision snapshot into one idempotent private draft; public routes remain untouched.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, SQLite, Vitest, existing admin shell.

**Spec:** `docs/superpowers/specs/2026-09-17-knowledge-source-revisions-drafts-design.md`

## Global Constraints

- Obsidian remains read-only; no task may write a Vault file.
- Every source revision and publication draft is private and every draft API uses `withAdminSession`.
- Public code must not query a Vault, indexed note, source revision, or draft.
- Existing indexed-note reading and scan APIs keep their behavior.
- This iteration does not publish an article, transfer attachments, or add a Windows sync client.

---

### Task 1: Append-Only Source Revision Storage

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_knowledge_source_revisions/migration.sql`
- Modify: `src/lib/knowledge/vault-scanner.ts`
- Modify: `src/lib/services/knowledge-vaults.ts`
- Modify: `tests/knowledge-vault-scanner.test.ts`
- Modify: `tests/knowledge-vaults.test.ts`

**Interfaces:**
- Produces `ScannedKnowledgeNote.markdown: string`.
- Produces database model `KnowledgeSourceRevision` with unique `(vaultId, relativePath, contentHash)`.
- Extends `replaceIndex(id, result, report)` so a scan persists unseen snapshots while replacing the current index.

- [ ] **Step 1: Write failing scanner coverage for retained Markdown**

```ts
expect(result.notes[0]).toMatchObject({
  relativePath: "notes/entry.md",
  markdown: "# Entry\n",
});
```

- [ ] **Step 2: Run the scanner test and verify the `markdown` field is absent**

Run: `npm test -- tests/knowledge-vault-scanner.test.ts`

- [ ] **Step 3: Add the scanner field without adding a second filesystem read**

```ts
export type ScannedKnowledgeNote = {
  // existing indexed metadata
  markdown: string;
};

notes.push({
  // existing fields
  markdown: content,
});
```

- [ ] **Step 4: Write a service-repository test proving an unchanged path/hash is not recreated and a changed hash is appended**

```ts
await service.scan("vault-1");
expect(repository.sourceRevisions).toEqual([
  expect.objectContaining({ relativePath: "notes/entry.md", contentHash: "hash-a" }),
]);
```

- [ ] **Step 5: Run the focused service test and verify it fails because source revisions are not persisted**

Run: `npm test -- tests/knowledge-vaults.test.ts`

- [ ] **Step 6: Add schema, migration, and transactional persistence**

```prisma
model KnowledgeSourceRevision {
  id              String           @id @default(cuid())
  vaultId         String           @map("vault_id")
  relativePath    String           @map("relative_path")
  contentHash     String           @map("content_hash")
  markdown        String
  frontmatterJson String?          @map("frontmatter_json")
  origin          String           @default("LOCAL_SCAN")
  capturedAt      DateTime         @map("captured_at")
  vault           KnowledgeVault   @relation(fields: [vaultId], references: [id], onDelete: Cascade)
  drafts          KnowledgePublicationDraft[]

  @@unique([vaultId, relativePath, contentHash])
  @@index([vaultId, relativePath, capturedAt])
  @@map("knowledge_source_revisions")
}
```

Use a transaction callback to query existing unique keys, create only missing rows, then replace links and notes. Do not add a relation to `KnowledgeNote`.

- [ ] **Step 7: Run focused scanner and vault service tests**

Run: `npm test -- tests/knowledge-vault-scanner.test.ts tests/knowledge-vaults.test.ts`

- [ ] **Step 8: Commit**

```bash
git add prisma src/lib/knowledge/vault-scanner.ts src/lib/services/knowledge-vaults.ts tests/knowledge-vault-scanner.test.ts tests/knowledge-vaults.test.ts
git commit -m "feat: capture knowledge source revisions"
```

### Task 2: Private Draft Service And API

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: Task 1 migration before it is applied
- Create: `src/lib/services/knowledge-publications.ts`
- Create: `src/app/api/admin/knowledge/publications/drafts/route.ts`
- Modify: `tests/knowledge-vaults.test.ts`
- Modify: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- Produces `KnowledgePublicationDraft` with unique `sourceRevisionId`, copied Markdown and metadata, `DRAFT` status.
- Produces `knowledgePublicationService.createDraft(sourceRevisionId)` and `GET/POST /api/admin/knowledge/publications/drafts`.

- [ ] **Step 1: Write failing draft service tests for copied snapshots and idempotent creation**

```ts
await expect(service.createDraft("revision-1")).resolves.toMatchObject({
  sourceRevisionId: "revision-1",
  markdown: "# Entry",
  title: "Entry",
  tags: ["knowledge"],
  status: "DRAFT",
});
```

- [ ] **Step 2: Run the draft test and verify it fails because the service does not exist**

Run: `npm test -- tests/knowledge-publications.test.ts`

- [ ] **Step 3: Add the draft model and private service**

```prisma
model KnowledgePublicationDraft {
  id               String                    @id @default(cuid())
  sourceRevisionId String                    @unique @map("source_revision_id")
  sourceHash       String                    @map("source_hash")
  markdown         String
  title            String
  summary          String?
  tags             Json
  status           String                    @default("DRAFT")
  createdAt        DateTime                  @default(now()) @map("created_at")
  updatedAt        DateTime                  @updatedAt @map("updated_at")
  sourceRevision   KnowledgeSourceRevision   @relation(fields: [sourceRevisionId], references: [id], onDelete: Restrict)

  @@index([status, updatedAt])
  @@map("knowledge_publication_drafts")
}
```

Parse only string `title`, string `summary` or `excerpt`, and scalar `tags`. Fall back to the revision filename when title is unavailable. Return the existing draft on a repeated revision id.

- [ ] **Step 4: Add failing protected-route contract coverage**

```ts
expect(readProjectFile("src/app/api/admin/knowledge/publications/drafts/route.ts"))
  .toContain("withAdminSession");
```

- [ ] **Step 5: Add the route and run service plus contract tests**

Run: `npm test -- tests/knowledge-publications.test.ts tests/admin-ui-contracts.test.ts`

- [ ] **Step 6: Commit**

```bash
git add prisma src/lib/services/knowledge-publications.ts src/app/api/admin/knowledge/publications/drafts/route.ts tests/knowledge-publications.test.ts tests/admin-ui-contracts.test.ts
git commit -m "feat: create private knowledge drafts"
```

### Task 3: Revision And Draft Workspace

**Files:**
- Modify: `src/lib/services/knowledge-vaults.ts`
- Modify: `src/components/admin/types.ts`
- Modify: `src/components/admin/KnowledgeWorkspace.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- `KnowledgeVaultData` includes the selected vault's source revisions and private drafts.
- The selected note lists its captured revisions and exposes an idempotent “创建发布草稿” action.

- [ ] **Step 1: Write a failing workspace contract test**

```ts
expect(workspace).toContain("源修订");
expect(workspace).toContain("创建发布草稿");
expect(workspace).toContain("/api/admin/knowledge/publications/drafts");
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `npm test -- tests/admin-ui-contracts.test.ts`

- [ ] **Step 3: Return private revisions and drafts from the admin-only vault service**

Keep source revision Markdown out of the list response. Include identifiers, path, hash, origin, captured time, and draft metadata only.

- [ ] **Step 4: Add the revision list and draft action to the selected-note inspector**

Show an explicit re-scan empty state when an indexed note has no captured revision. Use `runAction`, `FeedbackCenter`, and existing request helpers. Update only local draft state after successful creation.

- [ ] **Step 5: Add responsive styles and verify the focused test**

Run: `npm test -- tests/admin-ui-contracts.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/knowledge-vaults.ts src/components/admin src/app/admin/admin.module.css tests/admin-ui-contracts.test.ts
git commit -m "feat: manage knowledge source revisions"
```

### Task 4: Full Verification

**Files:** None unless verification exposes a defect.

- [ ] **Step 1: Run all unit and contract tests**

Run: `npm test`

- [ ] **Step 2: Run lint and type checks**

Run: `npm run lint && npx tsc --noEmit`

- [ ] **Step 3: Validate and migrate an isolated SQLite database**

Run: `$env:DATABASE_URL='file:./workstation-verification.db'; npm run db:validate; npx prisma migrate deploy`

- [ ] **Step 4: Build production output against the isolated database**

Run: `$env:DATABASE_URL='file:./workstation-verification.db'; npm run build`

- [ ] **Step 5: Push `main` after a clean verification and a clean status**

```bash
git push origin main
git status --short
```
