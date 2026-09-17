# Knowledge Article Publication Design

## Goal

Publish a private knowledge draft as one immutable public article snapshot, then show only those article snapshots on public knowledge pages.

## Scope

This iteration covers draft publication, a public article list, and a public article detail page. It deliberately excludes draft editing, attachment transfer, collections, tag filters, search, and source-update notifications.

## Data Boundary

`KnowledgeArticle` copies a draft's source revision id and hash, slug, title, optional summary, tags, Markdown, and publication timestamp. One draft has at most one article. The relation is restrictive so an article cannot silently lose its provenance.

The article is the sole public knowledge data source. Public code never imports a Vault service, accesses a local path, or queries indexed notes, source revisions, or private drafts.

## Publication Flow

1. The admin selects a private draft and supplies a lowercase URL slug.
2. The service validates the slug and rejects drafts containing Obsidian attachment embeds (`![[...]]`) until a later explicit asset-selection feature exists.
3. The service uses the unique draft relation to create or return one article snapshot. It copies all public fields at this point.
4. A source scan and any later source revision cannot update the draft or article.
5. Public routes list and render only articles.

## Rendering And URL Rules

Slugs match `^[a-z0-9]+(?:-[a-z0-9]+)*$`, are 3 to 96 characters long, and are unique. The article page uses the existing safe Markdown conventions: GitHub-flavored tables, task lists, fenced code, and callout presentation; raw HTML does not execute and Dataview remains inert source text.

The public article page follows the established Dark Studio visual language without altering the homepage layout or colors.

## Security Constraints

- Publishing and all article-admin APIs require `withAdminSession`.
- An article is public only after the publish operation creates its immutable record.
- No article includes attachment URLs in this iteration.
- Invalid slugs, unknown drafts, and attachment embeds fail without creating or changing an article.
- Repeating a successful publish returns the existing article unchanged.

## Acceptance Evidence

- Publishing a draft creates an article whose Markdown and metadata equal the draft snapshot.
- Changing the Vault and scanning a newer revision leaves the existing article byte-for-byte unchanged.
- An attachment embed prevents publication.
- An unauthenticated user cannot publish or access admin article data.
- Public list/detail routes query articles only and render inert Markdown.
