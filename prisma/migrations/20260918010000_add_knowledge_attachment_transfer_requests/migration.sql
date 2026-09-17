CREATE TABLE "knowledge_attachment_transfer_requests" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "draft_id" TEXT NOT NULL,
  "source_revision_id" TEXT NOT NULL,
  "vault_id" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "knowledge_attachment_transfer_requests_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "knowledge_publication_drafts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "knowledge_attachment_transfer_requests_source_revision_id_fkey" FOREIGN KEY ("source_revision_id") REFERENCES "knowledge_source_revisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "knowledge_attachment_transfer_requests_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "knowledge_vaults" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "knowledge_attachment_transfer_requests_draft_id_target_key" ON "knowledge_attachment_transfer_requests"("draft_id", "target");
CREATE INDEX "knowledge_attachment_transfer_requests_vault_id_status_idx" ON "knowledge_attachment_transfer_requests"("vault_id", "status");
