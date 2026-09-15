# Personal Workstation Product Roadmap

## Product Positioning

Personal Workstation is a continuously updated online career profile and its private control console.

- The public site explains identity, current focus, professional evidence, capabilities, growth, and contact paths.
- The admin site manages structured career content, goals, knowledge assets, publishing, and automation.
- Dark Studio colors and the existing public homepage visual language are fixed constraints.
- The product has one administrator and does not include registration or role management.

## Delivery Rules

- Each iteration implements one to three related capabilities.
- Structured modules own their records; the homepage only selects, orders, and publishes them.
- Generated or synchronized content enters a draft state before it can become public.
- Public data must pass visibility and language-completeness checks.
- Existing public homepage layout, animation behavior, breakpoints, and visual identity remain stable unless a separately approved design requires a structural addition.

## V1 - Admin Foundation

### Iteration V1.1 - Admin Experience Foundation

- [x] Replace the generic login card with the approved Dark Studio branded login composition.
- [x] Split the admin workspace into route-addressable modules while preserving authentication checks.
- [x] Add a consistent admin shell with navigation, page headers, breadcrumbs, and account actions.
- [x] Add reusable loading, success, failure, empty, and destructive-confirmation patterns.
- [x] Preserve the existing dashboard, CMS, OKR, and media behavior during the shell migration.
- [x] Verify desktop, tablet, and mobile navigation and form layouts.

### Iteration V1.2 - Structured Homepage CMS

- [x] Replace the complete JSON textarea with forms for meta, navigation, hero, about, works, services, footer, and projects.
- [x] Provide a consistent Chinese/English editing mode.
- [x] Show unsaved state and warn before leaving with uncommitted changes.
- [x] Add section-level validation and a publish-readiness summary.
- [x] Keep draft, authenticated preview, atomic publish, version history, and rollback.
- [x] Make rollback restore into the active draft that must be previewed and published explicitly.
- [x] Integrate an asset picker into image fields.

### Iteration V1.3 - OKR And Execution Workspace

- [x] Organize OKR management around cycles instead of one nested page.
- [x] Add route-addressable cycle and Objective views.
- [x] Use structured drawers or dialogs for cycle, Objective, KR, and review editing.
- [x] Add a selected-KR quick check-in panel with progress history.
- [x] Add Action Items under KRs, including status, due date, and ordering.
- [x] Add optional recurring actions inside OKR rather than a separate habits module.
- [x] Surface stale, overdue, and at-risk KRs.
- [x] Guide the administrator from cycle completion into review creation.
- [x] Keep action completion separate from KR progress; it may suggest a check-in but never changes progress automatically.

### Iteration V1.4 - Media Library

- [x] Add upload progress, empty state, search, filtering, and preview.
- [x] Edit bilingual alternative text.
- [x] Track asset references and show their usage locations.
- [x] Prevent direct deletion of referenced assets.
- [x] Support replacing an asset while preserving references.

## V1.5 - Career Evidence

- [x] Add structured career activities with public/private and featured states.
- [ ] Add structured projects with context, responsibility, challenge, approach, result, links, and technology evidence.
- [ ] Add work and education experience timelines.
- [ ] Group skills by capability area and connect them to supporting projects or articles.
- [ ] Add resume-file management and a printable resume view.
- [ ] Recompose the public homepage as Identity, Now, Proof, Capability, Journey, and Contact without changing its visual language.
- [ ] Add working project-list and project-detail routes before exposing project CTAs.

## V2 - Obsidian Knowledge Assets

The Obsidian vault remains the source authoring environment. The workstation indexes, reviews, and selectively publishes its content.

### Vault Synchronization

- [ ] Register one or more local vaults, beginning with `F:\Project\Obsidian\个人技术栈`.
- [ ] Exclude `.obsidian`, `.trash`, `.claudian`, `.workbuddy`, and configured patterns.
- [ ] Detect additions, edits, moves, and possible deletions through relative paths, hashes, and modification times.
- [ ] Add full and incremental synchronization reports.
- [ ] Review deletions and conflicts before changing published content.
- [ ] Provide a lightweight Windows-side sync client because the deployed server cannot read the local `F:` drive.
- [ ] Synchronize Markdown first and transfer attachments lazily or when a note is prepared for publication.

### Obsidian Compatibility

- [ ] Parse YAML frontmatter, including title, aliases, tags, type, created date, and publication metadata.
- [ ] Preserve directory hierarchy and MOC/index notes.
- [ ] Resolve wikilinks, aliases, relative paths, heading links, and display labels.
- [ ] Build forward links, backlinks, and unresolved-link reports.
- [ ] Resolve Obsidian embeds and sibling `assets` folders.
- [ ] Render callouts, tables, fenced code, and Markdown task lists.
- [ ] Preserve unsupported Dataview blocks without executing them on the server.
- [ ] Treat normal Obsidian tasks as note content unless the administrator explicitly promotes one to an OKR Action Item.

### Knowledge Publishing

- [ ] Default every synchronized note to private.
- [ ] Provide a vault tree, note viewer, properties, links, backlinks, and publication inspector.
- [ ] Create a publication draft from a selected source revision.
- [ ] Keep the published article stable when the source note changes and show that an update is available.
- [ ] Publish only explicitly selected attachments.
- [ ] Add public article, knowledge collection, tag, and search pages.

## V3 - Automation And AI

Only the following automation capabilities are in scope.

- [ ] Synchronize selected GitHub projects and public contribution events.
- [ ] Generate a weekly activity draft from GitHub, OKR, projects, articles, and manual activities.
- [ ] Generate milestone drafts from meaningful OKR updates and completions.
- [ ] Generate career-timeline drafts from articles, projects, activities, and OKR milestones.
- [ ] Assist with project descriptions, weekly updates, and OKR reviews.

### AI Provider Configuration

- [ ] Support built-in OpenAI-compatible and Anthropic Messages adapters.
- [ ] Support a declarative custom JSON adapter with custom base URL and endpoint.
- [ ] Support Bearer, `x-api-key`, and configurable authentication headers.
- [ ] Configure request field mappings, message templates, and response extraction paths without executing arbitrary scripts.
- [ ] Pull and cache upstream model lists when a provider supports discovery.
- [ ] Allow manually entered models when discovery is unavailable.
- [ ] Configure default models by use case.
- [ ] Test provider connectivity before activation.
- [ ] Track model, latency, token usage, outcome, and failure reason without exposing credentials.
- [ ] Keep all AI output in drafts and preserve source content for comparison.

## Deferred And Excluded

- Multi-user permissions, registration, social feeds, comments, e-commerce, and a standalone task-management product are excluded.
- Calendar synchronization, generic webhooks, bookmark management, and unrelated third-party integrations are deferred unless a later product decision adds them explicitly.
- Bidirectional web editing back into the Obsidian vault is not part of the first knowledge iteration.

