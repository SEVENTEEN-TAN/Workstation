import { describe, expect, it } from "vitest";

import { siteContentSchema } from "../src/lib/content/schema";
import { fallbackSiteContent } from "../src/components/public/data";
import { createSiteContentService } from "../src/lib/services/site-content";
import { createOkrService } from "../src/lib/services/okr";
import { createPublicDataService } from "../src/lib/services/public-data";
import { requireAdminSession } from "../src/lib/services/auth-guard";
import { validateImageUpload } from "../src/lib/services/assets";

describe("site publishing", () => {
  it("archives the former release and publishes one complete validated snapshot in one transaction", async () => {
    const versions = [
      { id: "old", version: 1, status: "PUBLISHED", content: fallbackSiteContent, publishedAt: new Date() },
      { id: "draft", version: 2, status: "DRAFT", content: fallbackSiteContent, publishedAt: null },
    ];
    let transactions = 0;
    const service = createSiteContentService({
      async transaction(run) {
        transactions += 1;
        return run({
          async findVersion(id) { return versions.find((item) => item.id === id) ?? null; },
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

describe("public data service", () => {
  it("returns only published content and public children of public cycles", async () => {
    const service = createPublicDataService({
      async findPublishedSiteVersion() { return { content: fallbackSiteContent }; },
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
    await expect(service.getPublishedSiteContent()).resolves.toEqual(fallbackSiteContent);
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
});
