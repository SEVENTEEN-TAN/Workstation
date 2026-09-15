-- AlterTable
ALTER TABLE "experience_records" ADD COLUMN "is_current" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "experience_records" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "experience_records" ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

-- ReplaceIndex
DROP INDEX "experience_records_visibility_started_at_idx";
CREATE INDEX "experience_records_visibility_featured_is_current_sort_order_started_at_idx"
ON "experience_records"("visibility", "featured", "is_current", "sort_order", "started_at");
