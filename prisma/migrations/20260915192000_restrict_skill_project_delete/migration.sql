-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_skill_evidence" (
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
    CONSTRAINT "skill_evidence_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "portfolio_projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_skill_evidence" ("created_at", "id", "kind", "project_id", "skill_id", "sort_order", "title_en", "title_zh", "updated_at", "url") SELECT "created_at", "id", "kind", "project_id", "skill_id", "sort_order", "title_en", "title_zh", "updated_at", "url" FROM "skill_evidence";
DROP TABLE "skill_evidence";
ALTER TABLE "new_skill_evidence" RENAME TO "skill_evidence";
CREATE INDEX "skill_evidence_skill_id_sort_order_idx" ON "skill_evidence"("skill_id", "sort_order");
CREATE INDEX "skill_evidence_project_id_idx" ON "skill_evidence"("project_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
