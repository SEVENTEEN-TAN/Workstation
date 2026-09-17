# Windows Knowledge Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable a Windows client to safely synchronize a local Obsidian Vault's Markdown snapshots to the deployed WorkStation.

**Architecture:** A standalone Windows script reuses `scanVault` and posts a strict JSON snapshot to a bearer-token-protected server route. The server validates the transport payload, compares it with the existing private index, atomically refreshes index/link rows, appends immutable `WINDOWS_SYNC` revisions, and preserves all publication state. Private note viewing reads stored revisions rather than the server filesystem.

**Tech Stack:** Next.js route handlers, TypeScript, Zod, Prisma/SQLite, Node `crypto`, existing Vitest and `tsx` runtime.

**Spec:** `docs/superpowers/specs/2026-09-17-windows-knowledge-sync-design.md`

## Global Constraints

- The Obsidian Vault is read-only: no client or server operation writes, moves, deletes, or renames Vault files.
- The public application must not import Vault filesystem services or expose source Markdown, local paths, drafts, or credentials.
- The server stores only a SHA-256 hash of `KNOWLEDGE_SYNC_TOKEN`; raw tokens are never logged or persisted.
- Syncing never edits or deletes public articles, publication drafts, collections, or article attachment snapshots.
- Attachments are excluded from this iteration.
- Full Vitest, lint, TypeScript, Prisma validation, isolated SQLite migration, and production build must pass before merge.

---

### Task 1: Validate Transport Credentials And Payloads

**Files:**
- Create: `src/lib/knowledge/sync-auth.ts`
- Create: `src/lib/knowledge/sync-payload.ts`
- Test: `tests/knowledge-sync-auth.test.ts`
- Test: `tests/knowledge-sync-payload.test.ts`

**Interfaces:**
- Produces `verifyKnowledgeSyncToken(authorization, tokenHash): boolean`.
- Produces `knowledgeSyncPayloadSchema`, returning a `VaultScanResult`-compatible `scannedAt`, `notes`, and `links` object.

- [ ] **Step 1: Write failing authentication tests**

```ts
expect(verifyKnowledgeSyncToken("Bearer correct-token", sha256("correct-token"))).toBe(true);
expect(verifyKnowledgeSyncToken("Bearer wrong-token", sha256("correct-token"))).toBe(false);
expect(verifyKnowledgeSyncToken(null, sha256("correct-token"))).toBe(false);
```

- [ ] **Step 2: Run the authentication test**

Run: `npm test -- tests/knowledge-sync-auth.test.ts`

Expected: FAIL because `sync-auth.ts` does not exist.

- [ ] **Step 3: Implement timing-safe token verification**

```ts
const digest = createHash("sha256").update(token).digest();
return expected.length === digest.length && timingSafeEqual(expected, digest);
```

- [ ] **Step 4: Write failing payload tests**

```ts
expect(() => knowledgeSyncPayloadSchema.parse({ notes: [{ relativePath: "../secret.md" }] })).toThrow();
expect(() => knowledgeSyncPayloadSchema.parse(validPayload)).not.toThrow();
```

- [ ] **Step 5: Implement strict Zod schemas**

Require normalized relative Markdown paths, 64-character lower-case hashes, ISO dates, unique note paths, and only the scanner's explicit note/link keys. Reject `..`, absolute paths, duplicate paths, unknown fields, and invalid link targets.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm test -- tests/knowledge-sync-auth.test.ts tests/knowledge-sync-payload.test.ts`

Commit: `git add src/lib/knowledge tests/knowledge-sync-*.test.ts && git commit -m "feat: validate knowledge sync transport"`

### Task 2: Receive A Remote Snapshot Atomically

**Files:**
- Modify: `src/lib/services/knowledge-vaults.ts`
- Modify: `tests/knowledge-vaults.test.ts`

**Interfaces:**
- Produces `knowledgeVaultService.receiveTransportSync(vaultId, result)`.
- Reuses `buildKnowledgeSyncReport`, `noteData`, and `linkData`.

- [ ] **Step 1: Write a failing transport-service test**

```ts
await service.receiveTransportSync("vault-1", remoteResult);
expect(replacedResult.notes[0].markdown).toBe("# Remote note");
expect(revisions[0]).toMatchObject({ origin: "WINDOWS_SYNC" });
expect(existingPublishedArticle).toEqual(beforePublish);
```

- [ ] **Step 2: Run the service test**

Run: `npm test -- tests/knowledge-vaults.test.ts`

Expected: FAIL because `receiveTransportSync` does not exist.

- [ ] **Step 3: Generalize index replacement by revision origin**

Add an `origin: "LOCAL_SCAN" | "WINDOWS_SYNC"` argument to the internal replacement path. Use it only when creating new `KnowledgeSourceRevision` rows; keep the current local scanner behavior unchanged.

- [ ] **Step 4: Implement `receiveTransportSync`**

Verify the Vault exists and is enabled, calculate `buildKnowledgeSyncReport(current.notes, result.notes)`, then call the shared atomic replacement path with `WINDOWS_SYNC`. On failure, record a bounded failure message and retain the previous index.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- tests/knowledge-vaults.test.ts tests/knowledge-sync-report.test.ts`

Commit: `git add src/lib/services/knowledge-vaults.ts tests/knowledge-vaults.test.ts && git commit -m "feat: receive Windows knowledge snapshots"`

### Task 3: Serve Private Notes From Immutable Revisions

**Files:**
- Modify: `src/lib/services/knowledge-vaults.ts`
- Modify: `tests/knowledge-vaults.test.ts`
- Modify: `tests/knowledge-note-reader.test.ts`

**Interfaces:**
- `knowledgeVaultService.readNote(vaultId, relativePath)` returns the newest stored source revision body.

- [ ] **Step 1: Write a failing remote-reader test**

```ts
await expect(service.readNote("vault-1", "notes/remote.md"))
  .resolves.toEqual({ relativePath: "notes/remote.md", content: "# Remote" });
expect(readFromFilesystem).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the test**

Run: `npm test -- tests/knowledge-vaults.test.ts tests/knowledge-note-reader.test.ts`

Expected: FAIL because the service always invokes the filesystem reader.

- [ ] **Step 3: Add a repository method for the latest source revision**

Query by `vaultId` and `relativePath`, ordered by `capturedAt desc`, selecting only `markdown`. Confirm that the path remains in the active private note index before returning it.

- [ ] **Step 4: Switch `readNote` to the revision repository**

Return the source-revision Markdown; preserve the existing generic `Note unavailable` error for disabled Vaults, unknown paths, and absent revisions.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- tests/knowledge-vaults.test.ts tests/knowledge-note-reader.test.ts`

Commit: `git add src/lib/services/knowledge-vaults.ts tests/knowledge-vaults.test.ts tests/knowledge-note-reader.test.ts && git commit -m "feat: read synchronized knowledge revisions"`

### Task 4: Add The Private Sync Route

**Files:**
- Create: `src/app/api/sync/knowledge/vaults/[id]/route.ts`
- Modify: `tests/admin-ui-contracts.test.ts`
- Create: `tests/knowledge-sync-route.test.ts`

**Interfaces:**
- Consumes `Authorization: Bearer <token>` and `knowledgeSyncPayloadSchema`.
- Calls `knowledgeVaultService.receiveTransportSync(vaultId, result)`.
- Returns only sync report summary data.

- [ ] **Step 1: Write failing route contract tests**

```ts
expect(routeSource).toContain("verifyKnowledgeSyncToken");
expect(routeSource).not.toContain("withAdminSession");
expect(routeSource).toContain("receiveTransportSync");
```

- [ ] **Step 2: Run the route test**

Run: `npm test -- tests/knowledge-sync-route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement the route**

Reject missing `KNOWLEDGE_SYNC_TOKEN_HASH` or invalid authorization with a generic 401. Parse the bounded request body only after authentication, pass the validated result to the service, and use the existing JSON error helper for validation and service failures.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- tests/knowledge-sync-route.test.ts tests/admin-ui-contracts.test.ts`

Commit: `git add src/app/api/sync tests/knowledge-sync-route.test.ts tests/admin-ui-contracts.test.ts && git commit -m "feat: add private knowledge sync endpoint"`

### Task 5: Create The Windows Sync Client And Operator Guidance

**Files:**
- Create: `scripts/sync-knowledge.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/deployment.md`
- Create: `tests/knowledge-sync-client.test.ts`

**Interfaces:**
- Produces `npm run knowledge:sync`.
- Reads `KNOWLEDGE_SYNC_URL`, `KNOWLEDGE_SYNC_TOKEN`, `KNOWLEDGE_SYNC_VAULT_ID`, and `KNOWLEDGE_SYNC_VAULT_PATH`.

- [ ] **Step 1: Write failing client configuration and request tests**

```ts
expect(readSyncConfig({ KNOWLEDGE_SYNC_URL: "https://site.example", KNOWLEDGE_SYNC_TOKEN: "secret", KNOWLEDGE_SYNC_VAULT_ID: "vault-1", KNOWLEDGE_SYNC_VAULT_PATH: "F:\\Vault" })).toMatchObject({ vaultId: "vault-1" });
await expect(syncKnowledge(config, scan, fetcher)).resolves.toMatchObject({ addedCount: 1 });
```

- [ ] **Step 2: Run the client test**

Run: `npm test -- tests/knowledge-sync-client.test.ts`

Expected: FAIL because the client module does not exist.

- [ ] **Step 3: Implement the client**

Validate the four required environment values, scan with `scanVault`, send the JSON payload to the private endpoint with the bearer token, reject non-2xx responses without echoing secrets or note contents, and print only report counts.

- [ ] **Step 4: Document server and Windows configuration**

Document how to generate a 32-byte token, set only its SHA-256 hash in `/etc/personal-workstation.env`, set the raw token in Windows user environment variables, run a manual sync, and schedule the script with Windows Task Scheduler. State that attachments are not transferred.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- tests/knowledge-sync-client.test.ts`

Commit: `git add scripts/sync-knowledge.ts package.json README.md docs/deployment.md tests/knowledge-sync-client.test.ts && git commit -m "feat: add Windows knowledge sync client"`

### Task 6: Full Verification And Roadmap Update

**Files:**
- Modify: `docs/product-roadmap.md`

- [ ] **Step 1: Mark completed V2 transport capabilities**

Mark the Windows client and incremental report items complete. Keep deletion/conflict review and attachment transfer unchecked because they are separate future work.

- [ ] **Step 2: Run all verification commands**

Run:

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run db:validate
$env:DATABASE_URL='file:./workstation-verification.db'; npx prisma migrate deploy
npm run build
```

Expected: all commands exit successfully.

- [ ] **Step 3: Commit and push**

```powershell
git add docs/product-roadmap.md
git commit -m "docs: record Windows knowledge sync delivery"
git push origin main
```
