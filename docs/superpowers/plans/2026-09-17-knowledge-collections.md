# Knowledge Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add protected collection management and public ordered collection pages for immutable knowledge articles.

**Architecture:** A collection has explicit visibility and an ordered join table to immutable `KnowledgeArticle` records. Admin APIs and the collection workspace mutate only collection metadata and membership. Public routes query only public collection/article records through one service.

**Tech Stack:** Next.js App Router, TypeScript, Prisma SQLite, Zod, React, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-knowledge-collections-design.md`

## Global Constraints

- The Obsidian Vault remains read-only and does not participate in collection APIs or public pages.
- A collection slug matches `^[a-z0-9]+(?:-[a-z0-9]+)*$` and has 3 to 96 characters.
- Collections are `PRIVATE` until explicitly made `PUBLIC`.
- Public code never queries `KnowledgeVault`, `KnowledgeNote`, `KnowledgeSourceRevision`, or `KnowledgePublicationDraft`.
- Article records are immutable; collection operations change only membership and ordering.

---

### Task 1: Collection Persistence And Service

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260917173000_add_knowledge_collections/migration.sql`
- Create: `src/lib/services/knowledge-collections.ts`
- Create: `tests/knowledge-collections.test.ts`

**Interfaces:**
- Produces `knowledgeCollectionService.create(input)`, `update(id, input)`, `remove(id)`, `listAdmin()`, `listPublic()` and `getPublic(slug)`.
- Produces an ordered `articleIds` write contract for collection membership.

- [ ] **Step 1: Write failing service tests**

```ts
await expect(service.create({ title: "Java", slug: "java", visibility: "PUBLIC", articleIds: ["a2", "a1"] }))
  .resolves.toMatchObject({ slug: "java" });
await expect(service.getPublic("private")).resolves.toBeNull();
expect(writes[0].articleIds).toEqual(["a2", "a1"]);
```

- [ ] **Step 2: Run the new service test**

Run: `npm test -- tests/knowledge-collections.test.ts`

Expected: FAIL because the collection service is absent.

- [ ] **Step 3: Add the schema and migration**

```prisma
model KnowledgeCollection {
  id          String                       @id @default(cuid())
  title       String
  description String?
  slug        String                       @unique
  visibility  String                       @default("PRIVATE")
  sortOrder   Int                          @default(0)
  createdAt   DateTime                     @default(now())
  updatedAt   DateTime                     @updatedAt
  articles    KnowledgeCollectionArticle[]
}

model KnowledgeCollectionArticle {
  collectionId String
  articleId    String
  sortOrder    Int
  collection   KnowledgeCollection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  article      KnowledgeArticle    @relation(fields: [articleId], references: [id], onDelete: Restrict)

  @@id([collectionId, articleId])
  @@index([articleId])
}
```

- [ ] **Step 4: Implement the service**

Validate title, optional description, slug, visibility and duplicate-free article ids with Zod. Verify every selected id is a published article before replacing the join rows in one transaction. `listPublic` and `getPublic` filter `visibility: "PUBLIC"` and select article snapshots only.

- [ ] **Step 5: Verify service and schema**

Run: `npm test -- tests/knowledge-collections.test.ts && npm run db:validate`

- [ ] **Step 6: Commit**

```bash
git add prisma src/lib/services/knowledge-collections.ts tests/knowledge-collections.test.ts
git commit -m "feat: add knowledge collections"
```

### Task 2: Protected Collection Administration

**Files:**
- Create: `src/app/api/admin/knowledge/collections/route.ts`
- Create: `src/app/api/admin/knowledge/collections/[id]/route.ts`
- Create: `src/app/admin/(workspace)/knowledge/collections/page.tsx`
- Create: `src/components/admin/KnowledgeCollectionsWorkspace.tsx`
- Modify: `src/components/admin/KnowledgeWorkspace.tsx`
- Modify: `src/app/admin/admin.module.css`
- Modify: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- `POST /api/admin/knowledge/collections` and `PATCH`/`DELETE /api/admin/knowledge/collections/[id]` consume validated collection inputs.
- The admin collection workspace receives `initialCollections` and `initialArticles` from the service.

- [ ] **Step 1: Write failing contract tests**

```ts
expect(readProjectFile("src/app/api/admin/knowledge/collections/route.ts")).toContain("withAdminSession");
expect(readProjectFile("src/components/admin/KnowledgeCollectionsWorkspace.tsx")).toContain("articleIds");
expect(readProjectFile("src/components/admin/KnowledgeWorkspace.tsx")).toContain("/admin/knowledge/collections");
```

- [ ] **Step 2: Run the contract tests**

Run: `npm test -- tests/admin-ui-contracts.test.ts`

Expected: FAIL because collection routes and workspace are absent.

- [ ] **Step 3: Implement protected routes and server page**

Use `withAdminSession`, `readJson` and `jsonError`. The server page loads admin collection records and published article choices without reading the Vault.

- [ ] **Step 4: Implement the compact workspace**

Use the existing admin form, feedback and confirmation patterns. The editor supplies title, description, slug, visibility and article checkboxes in saved order. A delete confirmation states that articles will remain intact.

- [ ] **Step 5: Add a knowledge-area link and responsive styles**

Link from the existing knowledge workspace to collection management. Add only local grid and checkbox styles in `admin.module.css`; preserve the Dark Studio palette.

- [ ] **Step 6: Verify the administration slice**

Run: `npm test -- tests/admin-ui-contracts.test.ts && npx tsc --noEmit && npm run lint`

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/knowledge/collections src/app/admin/(workspace)/knowledge/collections src/components/admin src/app/admin/admin.module.css tests/admin-ui-contracts.test.ts
git commit -m "feat: manage knowledge collections"
```

### Task 3: Public Collection Pages

**Files:**
- Create: `src/app/knowledge/collections/page.tsx`
- Create: `src/app/knowledge/collections/[slug]/page.tsx`
- Modify: `src/app/knowledge/page.tsx`
- Modify: `src/app/knowledge/knowledge.module.css`
- Modify: `tests/public-knowledge.test.ts`

**Interfaces:**
- `/knowledge/collections` consumes `knowledgeCollectionService.listPublic()`.
- `/knowledge/collections/[slug]` consumes `knowledgeCollectionService.getPublic(slug)` and calls `notFound()` for absent/private collections.

- [ ] **Step 1: Write failing public-route tests**

```ts
expect(collectionRoute).toContain("getPublic");
expect(`${collectionList}\n${collectionRoute}`).not.toContain("knowledgeVaultService");
expect(`${collectionList}\n${collectionRoute}`).not.toContain("KnowledgePublicationDraft");
```

- [ ] **Step 2: Run the public tests**

Run: `npm test -- tests/public-knowledge.test.ts`

Expected: FAIL because the collection pages do not exist.

- [ ] **Step 3: Implement public collection list and detail pages**

Reuse the existing knowledge-page visual language. The list shows title, description and article count. The detail renders ordered links to immutable article routes; no collection page renders private source data.

- [ ] **Step 4: Link the article index to collections**

Add a concise link beside the existing public knowledge filters. Do not alter homepage structure or colors.

- [ ] **Step 5: Verify public routes**

Run: `npm test -- tests/public-knowledge.test.ts && npm test`

- [ ] **Step 6: Commit**

```bash
git add src/app/knowledge src/lib/services/knowledge-collections.ts tests/public-knowledge.test.ts
git commit -m "feat: add public knowledge collections"
```

### Task 4: Full Verification And Roadmap

**Files:**
- Modify: `docs/product-roadmap.md`

- [ ] **Step 1: Mark the collection capability delivered**

Split the existing combined article/collection/tag/search roadmap line into completed article/tag/search and completed collection statements only after Tasks 1-3 pass.

- [ ] **Step 2: Run full checks**

Run:

```powershell
npm test
npm run lint
npx tsc --noEmit
npm run db:validate
$env:DATABASE_URL='file:./workstation-verification.db'; npx prisma migrate deploy
$env:DATABASE_URL='file:./workstation-verification.db'; npm run build
git diff --check
```

- [ ] **Step 3: Commit and push**

```bash
git add docs/product-roadmap.md
git commit -m "docs: complete knowledge collection roadmap"
git push origin main
```
