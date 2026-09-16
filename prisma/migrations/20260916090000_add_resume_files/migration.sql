-- CreateTable
CREATE TABLE "resume_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "locale" TEXT NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "resume_files_locale_key" ON "resume_files"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "resume_files_storage_path_key" ON "resume_files"("storage_path");

-- CreateIndex
CREATE INDEX "resume_files_visibility_locale_idx" ON "resume_files"("visibility", "locale");
