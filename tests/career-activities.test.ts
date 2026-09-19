import { describe, expect, it } from "vitest";

import { createCareerActivityService } from "../src/lib/services/career-activities";
import { careerActivityInputSchema } from "../src/lib/validators/career-activities";

describe("career activity validation", () => {
  it("normalizes optional fields and accepts a private activity", () => {
    expect(careerActivityInputSchema.parse({
      titleZh: "  发布个人工作站  ",
      titleEn: "   ",
      summaryZh: "  完成第一版公开站点。  ",
      summaryEn: "",
      occurredAt: "2026-09-15T08:00:00.000Z",
      visibility: "PRIVATE",
      featured: false,
      linkUrl: "   ",
    })).toEqual({
      titleZh: "发布个人工作站",
      titleEn: null,
      summaryZh: "完成第一版公开站点。",
      summaryEn: null,
      occurredAt: new Date("2026-09-15T08:00:00.000Z"),
      visibility: "PRIVATE",
      featured: false,
      linkUrl: null,
    });
  });

  it("requires complete bilingual copy before an activity becomes public", () => {
    const result = careerActivityInputSchema.safeParse({
      titleZh: "发布个人工作站",
      summaryZh: "完成第一版公开站点。",
      occurredAt: "2026-09-15T08:00:00.000Z",
      visibility: "PUBLIC",
      featured: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(["titleEn", "summaryEn"]);
  });
});

describe("career activity service", () => {
  it("delegates CRUD operations with validated values", async () => {
    const calls: Array<{ type: string; value?: unknown }> = [];
    const service = createCareerActivityService({
      async listActivities() { return []; },
      async findActivity() { return { id: "activity-1", titleZh: "发布个人工作站", titleEn: null, summaryZh: "完成第一版公开站点。", summaryEn: null, occurredAt: new Date("2026-09-15T08:00:00.000Z"), visibility: "PRIVATE", featured: false, linkUrl: null }; },
      async createActivity(value) { calls.push({ type: "create", value }); return { id: "activity-1", ...value }; },
      async updateActivity(id, value) { calls.push({ type: `update:${id}`, value }); return { id, ...value }; },
      async deleteActivity(id) { calls.push({ type: `delete:${id}` }); return { id }; },
      async listPublicActivities() { return []; },
    });

    await service.create({
      titleZh: "发布个人工作站",
      summaryZh: "完成第一版公开站点。",
      occurredAt: "2026-09-15T08:00:00.000Z",
      visibility: "PRIVATE",
      featured: false,
    });
    await service.update("activity-1", { featured: true });
    await service.delete("activity-1");

    expect(calls.map((call) => call.type)).toEqual(["create", "update:activity-1", "delete:activity-1"]);
    expect(calls[0].value).toMatchObject({ titleZh: "发布个人工作站", visibility: "PRIVATE", featured: false });
    expect(calls[1].value).toEqual({ featured: true });
  });

  it("returns the admin list as JSON-safe activity views", async () => {
    const service = createCareerActivityService({
      async listActivities() {
        return [{
          id: "activity-1",
          titleZh: "发布个人工作站",
          titleEn: "Personal Workstation launch",
          summaryZh: "完成第一版公开站点。",
          summaryEn: "Shipped the first public site.",
          occurredAt: new Date("2026-09-15T08:00:00.000Z"),
          visibility: "PUBLIC",
          featured: true,
          linkUrl: "https://sqtan.com",
          createdAt: new Date("2026-09-15T09:00:00.000Z"),
          updatedAt: new Date("2026-09-15T10:00:00.000Z"),
        }];
      },
      async findActivity() { return null; },
      async createActivity() { throw new Error("not used"); },
      async updateActivity() { throw new Error("not used"); },
      async deleteActivity() { throw new Error("not used"); },
      async listPublicActivities() { return []; },
    });

    await expect(service.list()).resolves.toEqual([{
      id: "activity-1",
      titleZh: "发布个人工作站",
      titleEn: "Personal Workstation launch",
      summaryZh: "完成第一版公开站点。",
      summaryEn: "Shipped the first public site.",
      occurredAt: "2026-09-15T08:00:00.000Z",
      visibility: "PUBLIC",
      featured: true,
      linkUrl: "https://sqtan.com",
      createdAt: "2026-09-15T09:00:00.000Z",
      updatedAt: "2026-09-15T10:00:00.000Z",
    }]);
  });

  it("keeps only bilingual public records and orders featured items first", async () => {
    const service = createCareerActivityService({
      async listActivities() { return []; },
      async findActivity() { return null; },
      async createActivity() { throw new Error("not used"); },
      async updateActivity() { throw new Error("not used"); },
      async deleteActivity() { throw new Error("not used"); },
      async listPublicActivities() {
        return [
          { id: "private", visibility: "PRIVATE", featured: true, occurredAt: new Date("2026-09-15"), titleZh: "私密", titleEn: "Private", summaryZh: "私密", summaryEn: "Private" },
          { id: "new", visibility: "PUBLIC", featured: false, occurredAt: new Date("2026-09-15"), titleZh: "最新", titleEn: "Newest", summaryZh: "最新", summaryEn: "Newest" },
          { id: "incomplete", visibility: "PUBLIC", featured: true, occurredAt: new Date("2026-09-14"), titleZh: "不完整", titleEn: null, summaryZh: "不完整", summaryEn: null },
          { id: "featured", visibility: "PUBLIC", featured: true, occurredAt: new Date("2026-09-01"), titleZh: "精选", titleEn: "Featured", summaryZh: "精选", summaryEn: "Featured" },
        ];
      },
    });

    await expect(service.listPublic()).resolves.toMatchObject([
      { id: "featured" },
      { id: "new" },
    ]);
  });
});
