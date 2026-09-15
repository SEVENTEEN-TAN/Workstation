-- CreateTable
CREATE TABLE "skill_areas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name_zh" TEXT NOT NULL,
    "name_en" TEXT,
    "description_zh" TEXT NOT NULL,
    "description_en" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "area_id" TEXT NOT NULL,
    "name_zh" TEXT NOT NULL,
    "name_en" TEXT,
    "summary_zh" TEXT NOT NULL,
    "summary_en" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "skills_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "skill_areas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "skill_evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skill_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "project_id" TEXT,
    "title_zh" TEXT,
    "title_en" TEXT,
    "url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "skill_evidence_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "skill_evidence_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "portfolio_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "skill_areas_visibility_sort_order_idx" ON "skill_areas"("visibility", "sort_order");

-- CreateIndex
CREATE INDEX "skills_area_id_sort_order_idx" ON "skills"("area_id", "sort_order");

-- CreateIndex
CREATE INDEX "skills_visibility_sort_order_idx" ON "skills"("visibility", "sort_order");

-- CreateIndex
CREATE INDEX "skill_evidence_skill_id_sort_order_idx" ON "skill_evidence"("skill_id", "sort_order");

-- CreateIndex
CREATE INDEX "skill_evidence_project_id_idx" ON "skill_evidence"("project_id");
