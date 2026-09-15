-- CreateTable
CREATE TABLE "action_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key_result_id" TEXT NOT NULL,
    "title_zh" TEXT NOT NULL,
    "title_en" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "due_date" DATETIME,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "recurrence_type" TEXT NOT NULL DEFAULT 'NONE',
    "recurrence_interval" INTEGER NOT NULL DEFAULT 1,
    "recurrence_days" TEXT,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "action_items_key_result_id_fkey" FOREIGN KEY ("key_result_id") REFERENCES "key_results" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "action_items_key_result_id_sort_order_idx" ON "action_items"("key_result_id", "sort_order");

-- CreateIndex
CREATE INDEX "action_items_status_due_date_idx" ON "action_items"("status", "due_date");
