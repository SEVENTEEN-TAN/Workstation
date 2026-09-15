-- CreateTable
CREATE TABLE "portfolio_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title_zh" TEXT NOT NULL,
    "title_en" TEXT,
    "summary_zh" TEXT NOT NULL,
    "summary_en" TEXT,
    "context_zh" TEXT NOT NULL,
    "context_en" TEXT,
    "responsibility_zh" TEXT NOT NULL,
    "responsibility_en" TEXT,
    "challenge_zh" TEXT NOT NULL,
    "challenge_en" TEXT,
    "approach_zh" TEXT NOT NULL,
    "approach_en" TEXT,
    "result_zh" TEXT NOT NULL,
    "result_en" TEXT,
    "cover_image" TEXT,
    "cover_alt_zh" TEXT,
    "cover_alt_en" TEXT,
    "technologies" JSONB NOT NULL,
    "links" JSONB NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_projects_slug_key" ON "portfolio_projects"("slug");

-- CreateIndex
CREATE INDEX "portfolio_projects_visibility_featured_sort_order_idx" ON "portfolio_projects"("visibility", "featured", "sort_order");
