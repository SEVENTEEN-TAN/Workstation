# Knowledge Article Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create immutable public article snapshots from private knowledge drafts and render them through public article routes.

**Architecture:** A unique draft-to-article relation makes publication idempotent and copies the complete draft snapshot. Admin publication is protected; public routes depend only on `KnowledgeArticle` and render Markdown through a shared no-HTML renderer.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, SQLite, React Markdown, remark-gfm, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-knowledge-article-publication-design.md`

## Global Constraints

- Never write to an Obsidian Vault.
- Public code must not query a Vault, indexed note, source revision, or private draft.
- Every publish request uses `withAdminSession`.
- Slugs match `^[a-z0-9]+(?:-[a-z0-9]+)*$` and are 3 to 96 characters long.
- Attachment embeds block publication until an explicit asset-selection workflow exists.
- Raw HTML and Dataview never execute in a public article.

---

### Task 1: Immutable Article Service

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_knowledge_articles/migration.sql`
- Create: `src/lib/services/knowledge-articles.ts`
- Create: `tests/knowledge-articles.test.ts`

**Interfaces:**
- Produces `knowledgeArticleService.publishDraft(draftId, slug)`.
- Produces `KnowledgeArticle` with one unique `draftId` and copied draft data.

- [ ] **Step 1: Write failing publication tests**

```ts
await expect(service.publishDraft("draft-1", "workstation-notes")).resolves.toMatchObject({
  draftId: "draft-1",
  slug: "workstation-notes",
  markdown: "# Snapshot",
});
await expect(service.publishDraft("draft-embed", "with-asset")).rejects.toThrow("Article not ready");
```

- [ ] **Step 2: Run the new test and verify the service is missing**

Run: `npm test -- tests/knowledge-articles.test.ts`

- [ ] **Step 3: Add schema and migration**

```prisma
model KnowledgeArticle {
  id               String                    @id @default(cuid())
  draftId          String                    @unique @map("draft_id")
  sourceRevisionId String                    @map("source_revision_id")
  sourceHash       String                    @map("source_hash")
  slug             String                    @unique
  markdown         String
  title            String
  summary          String?
  tags             Json
  publishedAt      DateTime                  @default(now()) @map("published_at")
  draft            KnowledgePublicationDraft @relation(fields: [draftId], references: [id], onDelete: Restrict)

  @@index([publishedAt])
  @@map("knowledge_articles")
}
```

- [ ] **Step 4: Implement the protected-independent service**

Use `upsert` by `draftId`; validate the slug before database access and reject `/!\[\[[^\]]+\]\]/` before creating an article. Copy values from the selected draft only.

- [ ] **Step 5: Run the focused service test and validate the schema**

Run: `npm test -- tests/knowledge-articles.test.ts && npm run db:validate`

- [ ] **Step 6: Commit**

```bash
git add prisma src/lib/services/knowledge-articles.ts tests/knowledge-articles.test.ts
git commit -m "feat: publish immutable knowledge articles"
```

### Task 2: Admin Publication Command

**Files:**
- Create: `src/app/api/admin/knowledge/articles/route.ts`
- Modify: `src/components/admin/KnowledgeWorkspace.tsx`
- Modify: `src/components/admin/types.ts`
- Modify: `src/app/admin/admin.module.css`
- Modify: `tests/admin-ui-contracts.test.ts`

**Interfaces:**
- `POST /api/admin/knowledge/articles` consumes `{ draftId, slug }`.
- A source revision with a draft shows a slug field and a `发布文章` command.

- [ ] **Step 1: Write a failing admin contract test**

```ts
expect(readProjectFile("src/app/api/admin/knowledge/articles/route.ts")).toContain("withAdminSession");
expect(workspace).toContain("发布文章");
expect(workspace).toContain("/api/admin/knowledge/articles");
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run: `npm test -- tests/admin-ui-contracts.test.ts`

- [ ] **Step 3: Add the protected API route**

Parse `draftId` as a nonempty 128-character string and `slug` with the required slug expression. Return `201` for the published or pre-existing article and use `jsonError` for failures.

- [ ] **Step 4: Add per-draft slug input and publish feedback**

Use local state keyed by draft id, `runAction`, and the existing `FeedbackCenter`. Disable the command while pending. Never display source revision Markdown in this workspace view.

- [ ] **Step 5: Run focused contract tests**

Run: `npm test -- tests/admin-ui-contracts.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/knowledge/articles src/components/admin src/app/admin/admin.module.css tests/admin-ui-contracts.test.ts
git commit -m "feat: publish knowledge drafts from admin"
```

### Task 3: Public Article Pages And Safe Renderer

**Files:**
- Create: `src/components/knowledge/KnowledgeMarkdown.tsx`
- Create: `src/app/knowledge/page.tsx`
- Create: `src/app/knowledge/[slug]/page.tsx`
- Create: `src/app/knowledge/knowledge.module.css`
- Modify: `src/lib/services/knowledge-articles.ts`
- Create: `tests/public-knowledge.test.ts`

**Interfaces:**
- Produces `knowledgeArticleService.listPublicArticles()` and `getPublicArticle(slug)`.
- Public components consume article records only.

- [ ] **Step 1: Write failing public-data and safe-Markdown tests**

```ts
expect(articleRoute).toContain("getPublicArticle");
expect(articleRoute).not.toContain("knowledgeVaultService");
expect(renderToStaticMarkup(createElement(KnowledgeMarkdown, { content: "<script>x</script>" })))
  .toContain("&lt;script&gt;x&lt;/script&gt;");
```

- [ ] **Step 2: Run the public test and verify it fails**

Run: `npm test -- tests/public-knowledge.test.ts`

- [ ] **Step 3: Implement article-only queries and Markdown renderer**

Use React Markdown with `remarkGfm` and the existing Obsidian normalization behavior. Do not import admin CSS or any Vault service.

- [ ] **Step 4: Implement list and detail pages**

List article title, optional summary, tags, and publication date. Detail uses `notFound()` when the slug is absent and the public Dark Studio CSS module without changing the homepage.

- [ ] **Step 5: Run public and full regression tests**

Run: `npm test -- tests/public-knowledge.test.ts && npm test`

- [ ] **Step 6: Commit**

```bash
git add src/components/knowledge src/app/knowledge src/lib/services/knowledge-articles.ts tests/public-knowledge.test.ts
git commit -m "feat: add public knowledge articles"
```

### Task 4: Full Verification

**Files:** None unless verification exposes a defect.

- [ ] **Step 1: Run lint and type checks**

Run: `npm run lint && npx tsc --noEmit`

- [ ] **Step 2: Migrate an isolated SQLite database**

Run: `$env:DATABASE_URL='file:./workstation-verification.db'; npx prisma migrate deploy`

- [ ] **Step 3: Build production output with the isolated database**

Run: `$env:DATABASE_URL='file:./workstation-verification.db'; npm run build`

- [ ] **Step 4: Push `main` and confirm clean status**

```bash
git push origin main
git status --short
```
