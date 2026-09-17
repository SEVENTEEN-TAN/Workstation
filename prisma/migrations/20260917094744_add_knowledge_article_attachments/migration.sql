-- CreateTable
CREATE TABLE "knowledge_publication_draft_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draft_id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_publication_draft_attachments_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "knowledge_publication_drafts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "knowledge_publication_draft_attachments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "knowledge_article_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "article_id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_article_attachments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "knowledge_publication_draft_attachments_asset_id_idx" ON "knowledge_publication_draft_attachments"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_publication_draft_attachments_draft_id_target_key" ON "knowledge_publication_draft_attachments"("draft_id", "target");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_article_attachments_storage_path_key" ON "knowledge_article_attachments"("storage_path");

-- CreateIndex
CREATE INDEX "knowledge_article_attachments_sha256_idx" ON "knowledge_article_attachments"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_article_attachments_article_id_target_key" ON "knowledge_article_attachments"("article_id", "target");
