-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_knowledge_notes" (
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
    "is_moc" BOOLEAN NOT NULL DEFAULT false,
    "frontmatter_json" TEXT,
    "indexed_at" DATETIME NOT NULL,
    CONSTRAINT "knowledge_notes_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "knowledge_vaults" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_knowledge_notes" ("content_hash", "directory_path", "file_name", "frontmatter_json", "has_callouts", "has_dataview", "has_embeds", "has_frontmatter", "has_tasks", "has_wikilinks", "id", "indexed_at", "modified_at", "relative_path", "size_bytes", "vault_id") SELECT "content_hash", "directory_path", "file_name", "frontmatter_json", "has_callouts", "has_dataview", "has_embeds", "has_frontmatter", "has_tasks", "has_wikilinks", "id", "indexed_at", "modified_at", "relative_path", "size_bytes", "vault_id" FROM "knowledge_notes";
DROP TABLE "knowledge_notes";
ALTER TABLE "new_knowledge_notes" RENAME TO "knowledge_notes";
CREATE INDEX "knowledge_notes_vault_id_directory_path_file_name_idx" ON "knowledge_notes"("vault_id", "directory_path", "file_name");
CREATE INDEX "knowledge_notes_content_hash_idx" ON "knowledge_notes"("content_hash");
CREATE UNIQUE INDEX "knowledge_notes_vault_id_relative_path_key" ON "knowledge_notes"("vault_id", "relative_path");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
