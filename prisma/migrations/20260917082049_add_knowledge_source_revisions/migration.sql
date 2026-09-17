-- CreateTable
CREATE TABLE "knowledge_source_revisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vault_id" TEXT NOT NULL,
    "relative_path" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "frontmatter_json" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'LOCAL_SCAN',
    "captured_at" DATETIME NOT NULL,
    CONSTRAINT "knowledge_source_revisions_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "knowledge_vaults" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "knowledge_source_revisions_vault_id_relative_path_captured_at_idx" ON "knowledge_source_revisions"("vault_id", "relative_path", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_source_revisions_vault_id_relative_path_content_hash_key" ON "knowledge_source_revisions"("vault_id", "relative_path", "content_hash");
