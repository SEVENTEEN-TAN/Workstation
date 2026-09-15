import { describe, expect, it } from "vitest";

import {
  createExperienceRecordService,
  parseExperienceRecord,
} from "../src/lib/services/experience-records";
import { experienceRecordInputSchema } from "../src/lib/validators/experience-records";

const completeExperience = {
  kind: "WORK",
  organizationZh: "示例科技",
  organizationEn: "Example Technology",
  titleZh: "高级后端工程师",
  titleEn: "Senior Backend Engineer",
  descriptionZh: "负责交易系统架构与核心服务演进。",
  descriptionEn: "Owned trading-system architecture and core service evolution.",
  locationZh: "上海",
  locationEn: "Shanghai",
  linkUrl: "https://example.com",
  startedAt: "2024-03-01",
  endedAt: "",
  isCurrent: true,
  featured: true,
  sortOrder: 2,
  visibility: "PUBLIC",
};

describe("experience record validation", () => {
  it("normalizes optional fields and allows an ongoing experience", () => {
    expect(experienceRecordInputSchema.parse({
      ...completeExperience,
      linkUrl: "   ",
      locationZh: "   ",
      locationEn: "",
    })).toMatchObject({
      kind: "WORK",
      organizationZh: "示例科技",
      organizationEn: "Example Technology",
      titleZh: "高级后端工程师",
      titleEn: "Senior Backend Engineer",
      descriptionZh: "负责交易系统架构与核心服务演进。",
      descriptionEn: "Owned trading-system architecture and core service evolution.",
      locationZh: null,
      locationEn: null,
      linkUrl: null,
      startedAt: new Date("2024-03-01T00:00:00.000Z"),
      endedAt: null,
      isCurrent: true,
      featured: true,
      sortOrder: 2,
      visibility: "PUBLIC",
    });
  });

  it("rejects an end date for a current experience", () => {
    const result = experienceRecordInputSchema.safeParse({
      ...completeExperience,
      endedAt: "2025-03-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["endedAt"],
        message: "当前经历不能填写结束日期",
      });
    }
  });

  it("requires complete English copy for public experience", () => {
    const result = experienceRecordInputSchema.safeParse({
      ...completeExperience,
      organizationEn: "",
      titleEn: "",
      descriptionEn: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual([
        "organizationEn",
        "titleEn",
        "descriptionEn",
      ]);
    }
  });

  it("rejects an end date before the start date", () => {
    const result = experienceRecordInputSchema.safeParse({
      ...completeExperience,
      startedAt: "2024-03-01",
      endedAt: "2024-02-01",
      isCurrent: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["endedAt"],
        message: "结束日期不能早于开始日期",
      });
    }
  });
});

describe("experience record service", () => {
  it("preserves database metadata when parsing records", () => {
    const createdAt = new Date("2026-09-16T00:00:00.000Z");
    const updatedAt = new Date("2026-09-16T01:00:00.000Z");

    expect(parseExperienceRecord({
      ...completeExperience,
      id: "experience-1",
      createdAt,
      updatedAt,
    })).toMatchObject({ id: "experience-1", createdAt, updatedAt });
  });

  it("delegates validated CRUD operations", async () => {
    const calls: Array<{ type: string; value?: unknown }> = [];
    const current = {
      id: "experience-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...experienceRecordInputSchema.parse(completeExperience),
    };
    const service = createExperienceRecordService({
      async listRecords() { return []; },
      async listPublicRecords() { return []; },
      async findRecord() { return current; },
      async createRecord(value) {
        calls.push({ type: "create", value });
        return { id: "experience-1", ...value };
      },
      async updateRecord(id, value) {
        calls.push({ type: `update:${id}`, value });
        return { id, ...value };
      },
      async deleteRecord(id) { calls.push({ type: `delete:${id}` }); return { id }; },
    });

    await service.create(completeExperience);
    await service.update("experience-1", { descriptionEn: "Updated" });
    await service.delete("experience-1");

    expect(calls.map((call) => call.type)).toEqual([
      "create",
      "update:experience-1",
      "delete:experience-1",
    ]);
    expect(calls[0].value).toMatchObject({ kind: "WORK", visibility: "PUBLIC" });
    expect(calls[1].value).toEqual({ descriptionEn: "Updated" });
  });

  it("returns only complete public records in featured, current, manual, and date order", async () => {
    const base = {
      createdAt: new Date(),
      updatedAt: new Date(),
      ...experienceRecordInputSchema.parse(completeExperience),
    };
    const service = createExperienceRecordService({
      async listRecords() { return []; },
      async listPublicRecords() {
        return [
          { ...base, id: "older", featured: false, isCurrent: false, sortOrder: 1, startedAt: new Date("2023-01-01"), endedAt: new Date("2023-12-01") },
          { ...base, id: "private", visibility: "PRIVATE" },
          { ...base, id: "incomplete", titleEn: null },
          { ...base, id: "current-later", featured: false, isCurrent: true, sortOrder: 2, startedAt: new Date("2025-01-01"), endedAt: null },
          { ...base, id: "current-first", featured: false, isCurrent: true, sortOrder: 1, startedAt: new Date("2024-01-01"), endedAt: null },
          { ...base, id: "featured", featured: true, isCurrent: false, sortOrder: 9, startedAt: new Date("2022-01-01"), endedAt: new Date("2022-12-01") },
        ];
      },
      async findRecord() { return null; },
      async createRecord() { throw new Error("not used"); },
      async updateRecord() { throw new Error("not used"); },
      async deleteRecord() { throw new Error("not used"); },
    });

    await expect(service.listPublic()).resolves.toMatchObject([
      { id: "featured" },
      { id: "current-first" },
      { id: "current-later" },
      { id: "older" },
    ]);
  });
});
