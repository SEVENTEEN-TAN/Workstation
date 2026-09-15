-- CreateTable
CREATE TABLE "experience_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "organization_zh" TEXT NOT NULL,
    "organization_en" TEXT,
    "title_zh" TEXT NOT NULL,
    "title_en" TEXT,
    "description_zh" TEXT NOT NULL,
    "description_en" TEXT,
    "location_zh" TEXT,
    "location_en" TEXT,
    "link_url" TEXT,
    "started_at" DATETIME NOT NULL,
    "ended_at" DATETIME,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "experience_records_visibility_started_at_idx" ON "experience_records"("visibility", "started_at");
