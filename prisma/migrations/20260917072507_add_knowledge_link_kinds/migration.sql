-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_knowledge_note_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vault_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LINK',
    "source_relative_path" TEXT NOT NULL,
    "target_raw" TEXT NOT NULL,
    "target_relative_path" TEXT,
    "target_heading" TEXT,
    "display_label" TEXT,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "indexed_at" DATETIME NOT NULL,
    CONSTRAINT "knowledge_note_links_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "knowledge_vaults" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_knowledge_note_links" ("display_label", "id", "indexed_at", "is_resolved", "source_relative_path", "target_heading", "target_raw", "target_relative_path", "vault_id") SELECT "display_label", "id", "indexed_at", "is_resolved", "source_relative_path", "target_heading", "target_raw", "target_relative_path", "vault_id" FROM "knowledge_note_links";
DROP TABLE "knowledge_note_links";
ALTER TABLE "new_knowledge_note_links" RENAME TO "knowledge_note_links";
CREATE INDEX "knowledge_note_links_vault_id_source_relative_path_idx" ON "knowledge_note_links"("vault_id", "source_relative_path");
CREATE INDEX "knowledge_note_links_vault_id_target_relative_path_idx" ON "knowledge_note_links"("vault_id", "target_relative_path");
CREATE INDEX "knowledge_note_links_vault_id_is_resolved_idx" ON "knowledge_note_links"("vault_id", "is_resolved");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
