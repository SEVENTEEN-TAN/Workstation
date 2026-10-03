CREATE TABLE "knowledge_graph_states" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "revision_id" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "imported_at" DATETIME NOT NULL,
    "published" JSONB,
    "published_at" DATETIME
);
