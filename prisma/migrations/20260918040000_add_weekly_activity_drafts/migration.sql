CREATE TABLE "weekly_activity_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week_start" DATETIME NOT NULL,
    "week_end" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title_zh" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "summary_zh" TEXT NOT NULL,
    "summary_en" TEXT NOT NULL,
    "source_snapshot" JSONB NOT NULL,
    "converted_activity_id" TEXT,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "weekly_activity_drafts_converted_activity_id_fkey" FOREIGN KEY ("converted_activity_id") REFERENCES "career_activities" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "weekly_activity_drafts_week_start_key" ON "weekly_activity_drafts"("week_start");
CREATE UNIQUE INDEX "weekly_activity_drafts_converted_activity_id_key" ON "weekly_activity_drafts"("converted_activity_id");
CREATE INDEX "weekly_activity_drafts_status_week_start_idx" ON "weekly_activity_drafts"("status", "week_start");
