-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "revoked_at" DATETIME,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "site_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "created_by_id" TEXT,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "site_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "original_filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "alt_text_zh" TEXT,
    "alt_text_en" TEXT,
    "is_referenced" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "okr_cycles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name_zh" TEXT NOT NULL,
    "name_en" TEXT,
    "type" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycle_id" TEXT NOT NULL,
    "title_zh" TEXT NOT NULL,
    "title_en" TEXT,
    "description_zh" TEXT,
    "description_en" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATETIME,
    "end_date" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "objectives_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "okr_cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "key_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "objective_id" TEXT NOT NULL,
    "title_zh" TEXT NOT NULL,
    "title_en" TEXT,
    "description_zh" TEXT,
    "description_en" TEXT,
    "progress_mode" TEXT NOT NULL,
    "start_value" REAL,
    "current_value" REAL,
    "target_value" REAL,
    "unit" TEXT,
    "manual_progress" REAL,
    "weight" REAL NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "key_results_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "objectives" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "kr_progress_updates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key_result_id" TEXT NOT NULL,
    "current_value" REAL,
    "manual_progress" REAL,
    "calculated_progress" REAL NOT NULL,
    "note_zh" TEXT,
    "note_en" TEXT,
    "recorded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kr_progress_updates_key_result_id_fkey" FOREIGN KEY ("key_result_id") REFERENCES "key_results" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycle_id" TEXT NOT NULL,
    "objective_id" TEXT,
    "achievements_zh" TEXT NOT NULL,
    "achievements_en" TEXT,
    "problems_zh" TEXT NOT NULL,
    "problems_en" TEXT,
    "lessons_zh" TEXT NOT NULL,
    "lessons_en" TEXT,
    "next_actions_zh" TEXT NOT NULL,
    "next_actions_en" TEXT,
    "score" REAL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "reviewed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "okr_cycles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "reviews_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "objectives" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "site_versions_version_key" ON "site_versions"("version");

-- CreateIndex
CREATE INDEX "site_versions_status_published_at_idx" ON "site_versions"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "assets_storage_path_key" ON "assets"("storage_path");

-- CreateIndex
CREATE INDEX "assets_sha256_idx" ON "assets"("sha256");

-- CreateIndex
CREATE INDEX "okr_cycles_status_start_date_end_date_idx" ON "okr_cycles"("status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "objectives_cycle_id_sort_order_idx" ON "objectives"("cycle_id", "sort_order");

-- CreateIndex
CREATE INDEX "objectives_visibility_status_idx" ON "objectives"("visibility", "status");

-- CreateIndex
CREATE INDEX "key_results_objective_id_sort_order_idx" ON "key_results"("objective_id", "sort_order");

-- CreateIndex
CREATE INDEX "kr_progress_updates_key_result_id_recorded_at_idx" ON "kr_progress_updates"("key_result_id", "recorded_at");

-- CreateIndex
CREATE INDEX "reviews_cycle_id_reviewed_at_idx" ON "reviews"("cycle_id", "reviewed_at");

-- CreateIndex
CREATE INDEX "reviews_objective_id_idx" ON "reviews"("objective_id");

-- CreateIndex
CREATE INDEX "reviews_visibility_idx" ON "reviews"("visibility");
