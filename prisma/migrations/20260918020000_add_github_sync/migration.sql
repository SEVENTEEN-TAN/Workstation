CREATE TABLE "github_sync_configs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "selected_repositories" JSONB NOT NULL,
  "last_sync_status" TEXT NOT NULL DEFAULT 'NEVER',
  "last_synced_at" DATETIME,
  "last_sync_error" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);
CREATE TABLE "github_repository_snapshots" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "github_id" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "html_url" TEXT NOT NULL,
  "homepage_url" TEXT,
  "primary_language" TEXT,
  "topics" JSONB NOT NULL,
  "stars" INTEGER NOT NULL DEFAULT 0,
  "forks" INTEGER NOT NULL DEFAULT 0,
  "is_fork" BOOLEAN NOT NULL DEFAULT false,
  "is_archived" BOOLEAN NOT NULL DEFAULT false,
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "pushed_at" DATETIME,
  "synced_at" DATETIME NOT NULL
);
CREATE TABLE "github_contribution_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "github_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "repository" TEXT NOT NULL,
  "url" TEXT,
  "occurred_at" DATETIME NOT NULL,
  "synced_at" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "github_repository_snapshots_github_id_key" ON "github_repository_snapshots"("github_id");
CREATE UNIQUE INDEX "github_repository_snapshots_full_name_key" ON "github_repository_snapshots"("full_name");
CREATE INDEX "github_repository_snapshots_selected_pushed_at_idx" ON "github_repository_snapshots"("selected", "pushed_at");
CREATE UNIQUE INDEX "github_contribution_events_github_id_key" ON "github_contribution_events"("github_id");
CREATE INDEX "github_contribution_events_occurred_at_idx" ON "github_contribution_events"("occurred_at");
