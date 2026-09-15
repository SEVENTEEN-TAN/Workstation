import { describe, expect, it } from "vitest";

import { siteContentSchema } from "../src/lib/content/schema";
import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import { createSiteContentService } from "../src/lib/services/site-content";
import { createOkrService } from "../src/lib/services/okr";
import { createPublicDataService } from "../src/lib/services/public-data";
import { requireAdminSession } from "../src/lib/services/auth-guard";
import {
  createAssetLibraryService,
  findAssetReferences,
  normalizeAssetAltText,
  validateImageUpload,
} from "../src/lib/services/assets";

describe("site publishing", () => {
  it("archives the former release and publishes one complete validated snapshot in one transaction", async () => {
    const versions = [
      { id: "old", version: 1, status: "PUBLISHED", content: bootstrapSiteContent, publishedAt: new Date() },
      { id: "draft", version: 2, status: "DRAFT", content: bootstrapSiteContent, publishedAt: null },
    ];
    let transactions = 0;
    const service = createSiteContentService({
      async transaction(run) {
        transactions += 1;
        return run({
          async findVersion(id) { return versions.find((item) => item.id === id) ?? null; },
          async findDraft() { return versions.find((item) => item.status === "DRAFT") ?? null; },
          async updateDraft() { throw new Error("not used"); },
          async archivePublished() { versions.filter((item) => item.status === "PUBLISHED").forEach((item) => { item.status = "ARCHIVED"; }); },
          async publishVersion(id, publishedAt) { const item = versions.find((entry) => entry.id === id)!; item.status = "PUBLISHED"; item.publishedAt = publishedAt; return item; },
          async latestVersionNumber() { return Math.max(...versions.map((item) => item.version)); },
          async createVersion() { throw new Error("not used"); },
        });
      },
      async listVersions() { return versions; },
      async findPublished() { return versions.find((item) => item.status === "PUBLISHED") ?? null; },
      async findDraft() { return versions.find((item) => item.status === "DRAFT") ?? null; },
      async updateDraft() { throw new Error("not used"); },
    });

    await service.publish("draft");

    expect(transactions).toBe(1);
    expect(versions.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "old", status: "ARCHIVED" },
      { id: "draft", status: "PUBLISHED" },
    ]);
    expect(siteContentSchema.safeParse(versions[1].content).success).toBe(true);
  });
});

describe("site rollback", () => {
  it("overwrites the existing draft without changing the published version", async () => {
    const sourceContent = structuredClone(bootstrapSiteContent);
    sourceContent.en.hero.lineOne = "RESTORED SOURCE";
    const versions = [
      { id: "published", version: 3, status: "PUBLISHED", content: bootstrapSiteContent, publishedAt: new Date("2026-09-01") },
      { id: "source", version: 1, status: "ARCHIVED", content: sourceContent, publishedAt: new Date("2026-08-01") },
      { id: "draft", version: 4, status: "DRAFT", content: bootstrapSiteContent, publishedAt: null },
    ];
    const service = createSiteContentService({
      async transaction(run) {
        return run({
          async findVersion(id) { return versions.find((item) => item.id === id) ?? null; },
          async findDraft() { return versions.find((item) => item.status === "DRAFT") ?? null; },
          async updateDraft(id, content) { const item = versions.find((entry) => entry.id === id)!; item.content = content; return item; },
          async archivePublished() { throw new Error("rollback must not archive published versions"); },
          async publishVersion() { throw new Error("rollback must not publish versions"); },
          async latestVersionNumber() { return Math.max(...versions.map((item) => item.version)); },
          async createVersion() { throw new Error("not used"); },
        });
      },
      async listVersions() { return versions; },
      async findPublished() { return versions.find((item) => item.status === "PUBLISHED") ?? null; },
      async findDraft() { return versions.find((item) => item.status === "DRAFT") ?? null; },
      async updateDraft() { throw new Error("not used"); },
    });

    const restored = await service.rollback("source", "author-1");

    expect(restored).toMatchObject({ id: "draft", version: 4, status: "DRAFT", publishedAt: null, content: sourceContent });
    expect(versions[0]).toMatchObject({ id: "published", version: 3, status: "PUBLISHED" });
  });

  it("creates the next draft with no publication date and retains the author when no draft exists", async () => {
    const sourceContent = structuredClone(bootstrapSiteContent);
    sourceContent.zh.hero.lineOne = "恢复的历史内容";
    const publishedAt = new Date("2026-09-01");
    const versions = [
      { id: "published", version: 4, status: "PUBLISHED", content: bootstrapSiteContent, publishedAt },
      { id: "source", version: 2, status: "ARCHIVED", content: sourceContent, publishedAt: new Date("2026-08-01") },
    ];
    let createdInput: unknown;
    const service = createSiteContentService({
      async transaction(run) {
        return run({
          async findVersion(id) { return versions.find((item) => item.id === id) ?? null; },
          async findDraft() { return null; },
          async updateDraft() { throw new Error("not used"); },
          async archivePublished() { throw new Error("rollback must not archive published versions"); },
          async publishVersion() { throw new Error("rollback must not publish versions"); },
          async latestVersionNumber() { return Math.max(...versions.map((item) => item.version)); },
          async createVersion(input) {
            createdInput = input;
            return { id: "new-draft", ...input, publishedAt: input.publishedAt ?? null };
          },
        });
      },
      async listVersions() { return versions; },
      async findPublished() { return versions.find((item) => item.status === "PUBLISHED") ?? null; },
      async findDraft() { return null; },
      async updateDraft() { throw new Error("not used"); },
    });

    const restored = await service.rollback("source", "author-2");

    expect(restored).toMatchObject({ id: "new-draft", version: 5, status: "DRAFT", publishedAt: null, content: sourceContent });
    expect(createdInput).toMatchObject({ version: 5, status: "DRAFT", publishedAt: null, createdById: "author-2", content: sourceContent });
    expect(versions[0]).toMatchObject({ id: "published", version: 4, status: "PUBLISHED", publishedAt });
  });
});

describe("public data service", () => {
  it("returns only published content and public children of public cycles", async () => {
    const service = createPublicDataService({
      async findPublishedSiteVersion() { return { content: bootstrapSiteContent }; },
      async findOkrCycles() {
        return [
          { id: "private-cycle", visibility: "PRIVATE", objectives: [{ id: "leak", visibility: "PUBLIC", keyResults: [] }], reviews: [] },
          { id: "public-cycle", visibility: "PUBLIC", objectives: [
            { id: "public-objective", visibility: "PUBLIC", sortOrder: 1, keyResults: [] },
            { id: "private-objective", visibility: "PRIVATE", sortOrder: 2, keyResults: [] },
          ], reviews: [{ id: "public-review", visibility: "PUBLIC" }, { id: "private-review", visibility: "PRIVATE" }] },
        ];
      },
    });

    const result = await service.getPublicOkrData();

    expect(result.map((cycle) => cycle.id)).toEqual(["public-cycle"]);
    expect(result[0].objectives.map((objective) => objective.id)).toEqual(["public-objective"]);
    expect(result[0].reviews.map((review) => review.id)).toEqual(["public-review"]);
    await expect(service.getPublishedSiteContent()).resolves.toEqual(bootstrapSiteContent);
  });

  it("reports an uninitialized site instead of manufacturing content", async () => {
    const service = createSiteContentService({
      transaction: async () => { throw new Error("not used"); },
      listVersions: async () => [],
      findPublished: async () => null,
      findDraft: async () => null,
      updateDraft: async () => { throw new Error("not used"); },
    });

    await expect(service.getPublished()).resolves.toBeNull();
    await expect(service.getOrCreateDraft()).rejects.toThrow("站点尚未初始化，请先运行数据库种子");
  });
});

describe("KR progress updates", () => {
  it("updates the KR and appends the calculated progress history atomically", async () => {
    const history: Array<{ keyResultId: string; calculatedProgress: number }> = [];
    const keyResult = { id: "kr-1", progressMode: "METRIC", startValue: 0, currentValue: 2, targetValue: 10, manualProgress: null };
    const service = createOkrService({
      async transaction(run) {
        return run({
          async findKeyResult(id) { return id === keyResult.id ? keyResult : null; },
          async updateKeyResultProgress(_id, values) { Object.assign(keyResult, values); return keyResult; },
          async createProgressUpdate(values) { history.push(values); return values; },
        });
      },
    } as never);

    const updated = await service.recordProgress("kr-1", { currentValue: 7, noteZh: "完成接口" });

    expect(updated.progress).toBe(70);
    expect(keyResult.currentValue).toBe(7);
    expect(history).toEqual([{ keyResultId: "kr-1", currentValue: 7, manualProgress: null, calculatedProgress: 70, noteZh: "完成接口", noteEn: null }]);
  });
});

describe("focused OKR queries", () => {
  it("returns cycle summaries through the focused list query", async () => {
    const cycles = [{ id: "cycle-1", objectives: [], reviews: [] }];
    const service = createOkrService({
      async listCycles() { return cycles; },
    });

    await expect(service.listCycles()).resolves.toBe(cycles);
  });

  it("returns null for a missing cycle", async () => {
    const service = createOkrService({
      async findCycle() { return null; },
    });

    await expect(service.getCycle("missing")).resolves.toBeNull();
  });

  it("rejects an Objective that does not belong to the requested cycle", async () => {
    const service = createOkrService({
      async findObjective() {
        return { id: "objective-1", cycleId: "cycle-a", cycle: { id: "cycle-a" }, keyResults: [], reviews: [] };
      },
    });

    await expect(service.getObjective("objective-1", "cycle-b")).resolves.toBeNull();
    await expect(service.getObjective("objective-1", "cycle-a")).resolves.toMatchObject({ id: "objective-1" });
  });
});

describe("admin protection", () => {
  it("rejects a request when there is no active session", async () => {
    await expect(requireAdminSession(async () => null)).rejects.toMatchObject({ status: 401 });
  });
});

describe("asset validation", () => {
  it("accepts a valid PNG and rejects spoofed or oversized images", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(validateImageUpload({ bytes: png, mimeType: "image/png", filename: "portrait.png", maxBytes: 20 }).extension).toBe("png");
    expect(() => validateImageUpload({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png", filename: "fake.png", maxBytes: 20 })).toThrow("文件内容与图片类型不匹配");
    expect(() => validateImageUpload({ bytes: png, mimeType: "image/png", filename: "portrait.png", maxBytes: 4 })).toThrow("图片大小超过限制");
  });

  it("normalizes bilingual alternative text and rejects excessive values", () => {
    expect(normalizeAssetAltText({ altTextZh: "  项目界面  ", altTextEn: "   " })).toEqual({
      altTextZh: "项目界面",
      altTextEn: null,
    });
    expect(() => normalizeAssetAltText({ altTextZh: "图".repeat(501), altTextEn: "" }))
      .toThrow("替代文本不能超过 500 个字符");
  });
});

describe("asset reference safety", () => {
  const referencedContent = structuredClone(bootstrapSiteContent);
  referencedContent.zh.projects[0].image = "/api/assets/asset-1";
  referencedContent.en.projects[1].image = "/api/assets/asset-1";

  it("reports every homepage version and field that references an asset", () => {
    expect(findAssetReferences("asset-1", [
      { id: "draft", version: 4, status: "DRAFT", content: referencedContent },
    ])).toEqual([
      { versionId: "draft", version: 4, status: "DRAFT", path: "zh.projects.0.image" },
      { versionId: "draft", version: 4, status: "DRAFT", path: "en.projects.1.image" },
    ]);
  });

  it("blocks deletion when any content version still references the asset", async () => {
    let deleted = false;
    const service = createAssetLibraryService({
      async listAssets() { return []; },
      async listSiteVersions() { return [{ id: "published", version: 3, status: "PUBLISHED", content: referencedContent }]; },
      async findAsset() { return { id: "asset-1", storagePath: "C:/uploads/image.png" }; },
      async updateAsset() { throw new Error("not used"); },
      async deleteAsset() { deleted = true; },
    }, async () => {});

    const error = await service.delete("asset-1").catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Response);
    expect(error).toMatchObject({ status: 409 });
    expect(deleted).toBe(false);
  });

  it("deletes an unreferenced asset record and its stored file", async () => {
    let deletedId = "";
    let removedPath = "";
    const service = createAssetLibraryService({
      async listAssets() { return []; },
      async listSiteVersions() { return []; },
      async findAsset(id) { return { id, storagePath: "C:/uploads/image.png" }; },
      async updateAsset() { throw new Error("not used"); },
      async deleteAsset(id) { deletedId = id; },
    }, async (path) => { removedPath = path; });

    await expect(service.delete("asset-1")).resolves.toEqual({ id: "asset-1" });
    expect(deletedId).toBe("asset-1");
    expect(removedPath).toBe("C:/uploads/image.png");
  });

  it("replaces the stored file while preserving the asset identity and alternative text", async () => {
    const events: string[] = [];
    const asset = {
      id: "asset-1",
      originalFilename: "old.png",
      storagePath: "C:/uploads/old.png",
      mimeType: "image/png",
      width: 120,
      height: 80,
      sizeBytes: 9,
      sha256: "old-hash",
      altTextZh: "项目界面",
      altTextEn: "Project screen",
    };
    const service = createAssetLibraryService({
      async listAssets() { return [asset]; },
      async listSiteVersions() { return []; },
      async findAsset() { return asset; },
      async updateAsset(id, data) {
        events.push(`update:${id}`);
        Object.assign(asset, data);
        return asset;
      },
      async deleteAsset() { throw new Error("not used"); },
    }, async (path) => { events.push(`remove:${path}`); }, async () => {
      events.push("write:new");
      return {
        originalFilename: "new.webp",
        storagePath: "C:/uploads/new.webp",
        mimeType: "image/webp",
        width: null,
        height: null,
        sizeBytes: 12,
        sha256: "new-hash",
      };
    });

    const replaced = await service.replace("asset-1", new File(["replacement"], "new.webp", { type: "image/webp" }));

    expect(events).toEqual(["write:new", "update:asset-1", "remove:C:/uploads/old.png"]);
    expect(replaced).toMatchObject({
      id: "asset-1",
      originalFilename: "new.webp",
      storagePath: "C:/uploads/new.webp",
      sha256: "new-hash",
      altTextZh: "项目界面",
      altTextEn: "Project screen",
    });
  });

  it("removes the newly written file when replacement metadata cannot be saved", async () => {
    const removed: string[] = [];
    const service = createAssetLibraryService({
      async listAssets() { return []; },
      async listSiteVersions() { return []; },
      async findAsset() { return { id: "asset-1", storagePath: "C:/uploads/old.png" }; },
      async updateAsset() { throw new Error("database unavailable"); },
      async deleteAsset() { throw new Error("not used"); },
    }, async (path) => { removed.push(path); }, async () => ({
      originalFilename: "new.png",
      storagePath: "C:/uploads/new.png",
      mimeType: "image/png",
      width: null,
      height: null,
      sizeBytes: 9,
      sha256: "new-hash",
    }));

    await expect(service.replace("asset-1", new File(["replacement"], "new.png", { type: "image/png" })))
      .rejects.toThrow("database unavailable");
    expect(removed).toEqual(["C:/uploads/new.png"]);
  });

  it("preserves the database error when replacement cleanup also fails", async () => {
    const service = createAssetLibraryService({
      async listAssets() { return []; },
      async listSiteVersions() { return []; },
      async findAsset() { return { id: "asset-1", storagePath: "C:/uploads/old.png" }; },
      async updateAsset() { throw new Error("database unavailable"); },
      async deleteAsset() { throw new Error("not used"); },
    }, async () => { throw new Error("cleanup unavailable"); }, async () => ({
      originalFilename: "new.png",
      storagePath: "C:/uploads/new.png",
      mimeType: "image/png",
      width: null,
      height: null,
      sizeBytes: 9,
      sha256: "new-hash",
    }));

    await expect(service.replace("asset-1", new File(["replacement"], "new.png", { type: "image/png" })))
      .rejects.toThrow("database unavailable");
  });

  it("returns 404 before writing a replacement for a missing asset", async () => {
    let wroteFile = false;
    const service = createAssetLibraryService({
      async listAssets() { return []; },
      async listSiteVersions() { return []; },
      async findAsset() { return null; },
      async updateAsset() { throw new Error("not used"); },
      async deleteAsset() { throw new Error("not used"); },
    }, async () => {}, async () => {
      wroteFile = true;
      throw new Error("must not write");
    });

    const error = await service.replace("missing", new File(["replacement"], "new.png", { type: "image/png" }))
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Response);
    expect(error).toMatchObject({ status: 404 });
    expect(wroteFile).toBe(false);
  });
});
