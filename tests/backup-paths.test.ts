import { describe, expect, it } from "vitest";

import { fallbackSiteContent } from "../src/components/public/data";
import { buildHomepageBaseline } from "../src/lib/backup/homepage-baseline";
import { resolveDatabaseFile, validateRestoreSource } from "../src/lib/backup/paths";

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

  it("exports the latest published and draft snapshots with resolved asset references", () => {
    const baseline = buildHomepageBaseline(
      [
        { id: "published-old", version: 1, status: "PUBLISHED", content: fallbackSiteContent, publishedAt: new Date("2026-08-01") },
        { id: "draft", version: 3, status: "DRAFT", content: fallbackSiteContent, publishedAt: null },
        { id: "published", version: 2, status: "PUBLISHED", content: fallbackSiteContent, publishedAt: new Date("2026-09-01") },
      ],
      [{ id: "asset-1", originalFilename: "project.webp", storagePath: "C:/uploads/project.webp", mimeType: "image/webp", sizeBytes: 12, sha256: "hash" }],
    );

    expect(baseline.published).toMatchObject({ id: "published", version: 2, status: "PUBLISHED", content: fallbackSiteContent });
    expect(baseline.draft).toMatchObject({ id: "draft", version: 3, status: "DRAFT", content: fallbackSiteContent });
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
