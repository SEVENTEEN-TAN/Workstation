# Knowledge Collections Design

## Goal

Let the administrator group immutable public knowledge articles into ordered, independently publishable collections, then provide public collection list and detail pages.

## Scope

This iteration creates collection records, ordered article membership, protected administration APIs and a compact management page under the existing knowledge workspace. Public pages show only public collections and the immutable article snapshots assigned to them.

It does not create article editions, copy Obsidian attachments, synchronize collections back to the vault, or add arbitrary public content outside `KnowledgeArticle` snapshots.

## Data Model

`KnowledgeCollection` contains a title, optional description, lowercase slug, visibility (`PRIVATE` by default or `PUBLIC`), display order and timestamps. `KnowledgeCollectionArticle` is an explicit join record containing the collection id, article id and display order. Both ids form a unique pair.

Articles remain immutable. Changing a collection changes grouping and order only; it does not change article Markdown, metadata, slug, source hash or publication time.

## Administration

The existing knowledge area links to `/admin/knowledge/collections`. The page lists collections and permits create, edit, delete and ordered article selection from already published articles. Every API is guarded by `withAdminSession`.

Collection input validates a lowercase slug with the same `3..96` URL rule used by articles. It rejects unknown article ids. Deleting a collection removes only its membership records and never the article itself.

## Public Data Boundary

The public collection service queries `KnowledgeCollection` and `KnowledgeArticle` only. It filters both the list and detail results to `PUBLIC` collections. Private collections, drafts, Vaults, source revisions, local paths and storage metadata never enter public responses.

`/knowledge` links to the public collections index. `/knowledge/collections` lists public collections that contain at least one public article. `/knowledge/collections/[slug]` renders the collection’s ordered article cards and returns `notFound()` for missing or private slugs.

## Acceptance Evidence

- A private collection cannot be read from any public route or service method.
- Article membership uses only published article ids and preserves its supplied order.
- Deleting a collection leaves its articles intact.
- Public collection pages use only the collection service, never a Vault or private draft service.
- Protected admin APIs reject an unauthenticated request.
