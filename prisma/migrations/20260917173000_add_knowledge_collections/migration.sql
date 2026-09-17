-- CreateTable
CREATE TABLE "knowledge_collections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "knowledge_collection_articles" (
    "collection_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("collection_id", "article_id"),
    CONSTRAINT "knowledge_collection_articles_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "knowledge_collections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "knowledge_collection_articles_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_collections_slug_key" ON "knowledge_collections"("slug");

-- CreateIndex
CREATE INDEX "knowledge_collections_visibility_sort_order_idx" ON "knowledge_collections"("visibility", "sort_order");

-- CreateIndex
CREATE INDEX "knowledge_collection_articles_article_id_idx" ON "knowledge_collection_articles"("article_id");
