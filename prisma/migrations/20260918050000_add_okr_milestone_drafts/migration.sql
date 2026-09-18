CREATE TABLE "okr_milestone_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title_zh" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "summary_zh" TEXT NOT NULL,
    "summary_en" TEXT NOT NULL,
    "occurred_at" DATETIME NOT NULL,
    "source_snapshot" JSONB NOT NULL,
    "converted_activity_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "okr_milestone_drafts_converted_activity_id_fkey" FOREIGN KEY ("converted_activity_id") REFERENCES "career_activities" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "okr_milestone_drafts_source_key_key" ON "okr_milestone_drafts"("source_key");
CREATE UNIQUE INDEX "okr_milestone_drafts_converted_activity_id_key" ON "okr_milestone_drafts"("converted_activity_id");
CREATE INDEX "okr_milestone_drafts_status_occurred_at_idx" ON "okr_milestone_drafts"("status", "occurred_at");
