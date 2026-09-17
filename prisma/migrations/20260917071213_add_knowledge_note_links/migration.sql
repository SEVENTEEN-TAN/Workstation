-- CreateTable
CREATE TABLE "knowledge_note_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vault_id" TEXT NOT NULL,
    "source_relative_path" TEXT NOT NULL,
    "target_raw" TEXT NOT NULL,
    "target_relative_path" TEXT,
    "target_heading" TEXT,
    "display_label" TEXT,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "indexed_at" DATETIME NOT NULL,
    CONSTRAINT "knowledge_note_links_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "knowledge_vaults" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "knowledge_note_links_vault_id_source_relative_path_idx" ON "knowledge_note_links"("vault_id", "source_relative_path");

-- CreateIndex
CREATE INDEX "knowledge_note_links_vault_id_target_relative_path_idx" ON "knowledge_note_links"("vault_id", "target_relative_path");

-- CreateIndex
CREATE INDEX "knowledge_note_links_vault_id_is_resolved_idx" ON "knowledge_note_links"("vault_id", "is_resolved");
