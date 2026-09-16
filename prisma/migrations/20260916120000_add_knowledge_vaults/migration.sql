-- CreateTable
CREATE TABLE "knowledge_vaults" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "root_path" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ignore_patterns" JSONB NOT NULL,
    "last_scan_status" TEXT NOT NULL DEFAULT 'NEVER',
    "last_scanned_at" DATETIME,
    "last_scan_file_count" INTEGER NOT NULL DEFAULT 0,
    "last_scan_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "knowledge_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vault_id" TEXT NOT NULL,
    "relative_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "directory_path" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "modified_at" DATETIME NOT NULL,
    "content_hash" TEXT NOT NULL,
    "has_frontmatter" BOOLEAN NOT NULL DEFAULT false,
    "has_wikilinks" BOOLEAN NOT NULL DEFAULT false,
    "has_embeds" BOOLEAN NOT NULL DEFAULT false,
    "has_callouts" BOOLEAN NOT NULL DEFAULT false,
    "has_dataview" BOOLEAN NOT NULL DEFAULT false,
    "has_tasks" BOOLEAN NOT NULL DEFAULT false,
    "indexed_at" DATETIME NOT NULL,
    CONSTRAINT "knowledge_notes_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "knowledge_vaults" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_vaults_root_path_key" ON "knowledge_vaults"("root_path");
CREATE INDEX "knowledge_vaults_enabled_name_idx" ON "knowledge_vaults"("enabled", "name");
CREATE UNIQUE INDEX "knowledge_notes_vault_id_relative_path_key" ON "knowledge_notes"("vault_id", "relative_path");
CREATE INDEX "knowledge_notes_vault_id_directory_path_file_name_idx" ON "knowledge_notes"("vault_id", "directory_path", "file_name");
CREATE INDEX "knowledge_notes_content_hash_idx" ON "knowledge_notes"("content_hash");
