CREATE TABLE "ai_content_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "use_case" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source_snapshot" JSONB NOT NULL,
    "content" JSONB NOT NULL,
    "provider_id" TEXT,
    "model" TEXT NOT NULL,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ai_content_drafts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ai_content_drafts_use_case_target_id_status_generated_at_idx" ON "ai_content_drafts"("use_case", "target_id", "status", "generated_at");
CREATE INDEX "ai_content_drafts_provider_id_idx" ON "ai_content_drafts"("provider_id");
