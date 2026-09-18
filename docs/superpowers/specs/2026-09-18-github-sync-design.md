# GitHub Project And Contribution Sync

## Goal

Synchronize selected public GitHub repositories and recent public contribution events into the private administration workspace. Synchronized records are evidence sources for later drafts; they never publish or overwrite portfolio content automatically.

## Configuration

The single administrator configures:

- GitHub username
- enabled state
- selected repository full names

An optional `GITHUB_TOKEN` remains server-side and is used only to raise API limits. The token is never returned by an API or persisted in the database.

## Data Model

- `GitHubSyncConfig`: singleton username, enabled state, selected repository names, last sync status, timestamp, and a sanitized error.
- `GitHubRepositorySnapshot`: GitHub ID, full name, description, URLs, primary language, topics, stars, forks, archive/fork flags, timestamps, selection state, and sync timestamp.
- `GitHubContributionEvent`: GitHub event ID, event type, repository name, event timestamp, public URL when derivable, and sync timestamp.

Repository and event identifiers are upsert keys so repeated syncs are idempotent. Records that disappear from a later response remain as historical evidence but are no longer marked as current selections.

## API Flow

1. `GET /api/admin/github` returns configuration and private snapshots.
2. `PUT /api/admin/github` validates and stores username, enabled state, and selected repositories.
3. `POST /api/admin/github/sync` fetches `/users/{username}/repos` and `/users/{username}/events/public`, validates response fields, upserts snapshots, and records sync status.
4. Every endpoint requires the existing administrator session.

## Admin Experience

Add `/admin/github` under an `自动化` navigation item. The page supports username configuration, repository selection, manual synchronization, last-result feedback, repository evidence, and recent contribution events. Empty, loading, success, and failure states use existing admin patterns.

## Safety And Failure Handling

- Accept only `https://api.github.com` as the upstream API.
- Send a bounded timeout and explicit API version header.
- Store no access token, raw response, email address, or private repository data.
- Keep existing snapshots when an upstream request fails and record a sanitized failure message.
- Do not create public projects or career activities during synchronization.

## Verification

- Validation tests for usernames and selected repository names.
- Service tests for response normalization, idempotent upserts, selection filtering, and failure status.
- Route contracts proving administrator-session protection.
- Admin UI tests for configuration, selection, sync feedback, and private-source messaging.
- Full migration, test, lint, type, and production-build checks.
