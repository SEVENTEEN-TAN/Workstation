-- CreateTable
CREATE TABLE "knowledge_publication_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_revision_id" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "tags" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "knowledge_publication_drafts_source_revision_id_fkey" FOREIGN KEY ("source_revision_id") REFERENCES "knowledge_source_revisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_publication_drafts_source_revision_id_key" ON "knowledge_publication_drafts"("source_revision_id");

-- CreateIndex
CREATE INDEX "knowledge_publication_drafts_status_updated_at_idx" ON "knowledge_publication_drafts"("status", "updated_at");
