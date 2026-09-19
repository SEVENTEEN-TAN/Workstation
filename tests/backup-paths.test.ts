import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import { buildHomepageBaseline } from "../src/lib/backup/homepage-baseline";
import { resolveDatabaseFile, validateRestoreSource } from "../src/lib/backup/paths";

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("backup paths", () => {
  it("resolves a relative Prisma SQLite URL from the prisma directory", () => {
    expect(resolveDatabaseFile("file:./workstation.db", "C:/workspace/WorkStation")).toBe(
      "C:\\workspace\\WorkStation\\prisma\\workstation.db",
    );
  });

  it("accepts an absolute SQLite URL", () => {
    expect(resolveDatabaseFile("file:/var/lib/workstation.db", "/srv/app")).toBe(
      "/var/lib/workstation.db",
    );
  });

  it("requires a manifest and database snapshot before restore", async () => {
    await expect(validateRestoreSource("C:/missing-backup")).rejects.toThrow(
      "备份目录不完整",
    );
  });

  it("treats optional media trees as absent until restore proves their shape", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "workstation-backup-"));
    await writeFile(path.join(directory, "manifest.json"), "{}", "utf8");
    await writeFile(path.join(directory, "workstation.db"), "", "utf8");

    try {
      await expect(validateRestoreSource(directory)).resolves.toMatchObject({
        uploadsPath: null,
        attachmentsPath: null,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed optional media trees before restore starts", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "workstation-backup-"));
    await writeFile(path.join(directory, "manifest.json"), "{}", "utf8");
    await writeFile(path.join(directory, "workstation.db"), "", "utf8");
    await mkdir(path.join(directory, "uploads"), { recursive: true });
    await writeFile(path.join(directory, "article-attachments"), "not a directory", "utf8");

    try {
      await expect(validateRestoreSource(directory)).rejects.toThrow(
        "备份目录不完整：article-attachments 不是目录",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("replaces media roots only when the backup contains that tree", () => {
    const restoreScript = readProjectFile("scripts/restore.ts");

    expect(restoreScript).toContain("if (source.uploadsPath)");
    expect(restoreScript).toContain("if (source.attachmentsPath)");
    expect(restoreScript).not.toContain('path.join(source.directory, "uploads")');
    expect(restoreScript).not.toContain('path.join(source.directory, "article-attachments")');
  });

  it("exports the latest published and draft snapshots with resolved asset references", () => {
    const baseline = buildHomepageBaseline(
      [
        { id: "published-old", version: 1, status: "PUBLISHED", content: bootstrapSiteContent, publishedAt: new Date("2026-08-01") },
        { id: "draft", version: 3, status: "DRAFT", content: bootstrapSiteContent, publishedAt: null },
        { id: "published", version: 2, status: "PUBLISHED", content: bootstrapSiteContent, publishedAt: new Date("2026-09-01") },
      ],
      [{ id: "asset-1", originalFilename: "project.webp", storagePath: "C:/uploads/project.webp", mimeType: "image/webp", sizeBytes: 12, sha256: "hash" }],
    );

    expect(baseline.published).toMatchObject({ id: "published", version: 2, status: "PUBLISHED", content: bootstrapSiteContent });
    expect(baseline.draft).toMatchObject({ id: "draft", version: 3, status: "DRAFT", content: bootstrapSiteContent });
    expect(baseline.assets).toEqual([{
      id: "asset-1",
      originalFilename: "project.webp",
      storagePath: "C:/uploads/project.webp",
      mimeType: "image/webp",
      sizeBytes: 12,
      sha256: "hash",
      references: [],
    }]);
  });
});
