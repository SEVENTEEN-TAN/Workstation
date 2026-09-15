-- CreateTable
CREATE TABLE "career_activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title_zh" TEXT NOT NULL,
    "title_en" TEXT,
    "summary_zh" TEXT NOT NULL,
    "summary_en" TEXT,
    "occurred_at" DATETIME NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "link_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "career_activities_visibility_featured_occurred_at_idx" ON "career_activities"("visibility", "featured", "occurred_at");
