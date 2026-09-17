-- CreateTable
CREATE TABLE "knowledge_sync_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vault_id" TEXT NOT NULL,
    "scanned_at" DATETIME NOT NULL,
    "added_count" INTEGER NOT NULL DEFAULT 0,
    "modified_count" INTEGER NOT NULL DEFAULT 0,
    "moved_count" INTEGER NOT NULL DEFAULT 0,
    "missing_count" INTEGER NOT NULL DEFAULT 0,
    "unchanged_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_sync_reports_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "knowledge_vaults" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "knowledge_sync_changes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "report_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "previous_relative_path" TEXT,
    "current_relative_path" TEXT,
    "previous_content_hash" TEXT,
    "current_content_hash" TEXT,
    "previous_modified_at" DATETIME,
    "current_modified_at" DATETIME,
    CONSTRAINT "knowledge_sync_changes_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "knowledge_sync_reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "knowledge_sync_reports_vault_id_scanned_at_idx" ON "knowledge_sync_reports"("vault_id", "scanned_at");
CREATE INDEX "knowledge_sync_changes_report_id_type_idx" ON "knowledge_sync_changes"("report_id", "type");
