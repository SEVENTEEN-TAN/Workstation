import { beforeEach, describe, expect, it, vi } from "vitest";

import { createWeeklyActivityDraftService } from "../src/lib/services/weekly-activity-drafts";
import { createOkrMilestoneDraftService } from "../src/lib/services/okr-milestone-drafts";
import { createCareerTimelineDraftService } from "../src/lib/services/career-timeline-drafts";

const { getDatabase } = vi.hoisted(() => ({ getDatabase: vi.fn() }));
vi.mock("../src/lib/db", () => ({ getDatabase }));

const timestamp = new Date("2026-09-20T00:00:00Z");
const validDraft = () => ({
  id: "draft-1", status: "DRAFT", titleZh: "周报", titleEn: "Update",
  summaryZh: "摘要", summaryEn: "Summary", weekEnd: timestamp, occurredAt: timestamp,
});

const services = [
  { name: "weekly", model: "weeklyActivityDraft", create: () => createWeeklyActivityDraftService() },
  { name: "milestone", model: "okrMilestoneDraft", create: () => createOkrMilestoneDraftService() },
  { name: "timeline", model: "careerTimelineDraft", create: () => createCareerTimelineDraftService() },
];

describe.each(services)("$name conversion validation", ({ model, create }) => {
  const findUnique = vi.fn();
  const createActivity = vi.fn();
  const update = vi.fn();
  const transaction = { [model]: { findUnique, update }, careerActivity: { create: createActivity } };

  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockReset().mockResolvedValue(validDraft());
    createActivity.mockReset().mockResolvedValue({ id: "activity-1" });
    update.mockReset().mockResolvedValue({ id: "draft-1", status: "CONVERTED", convertedActivityId: "activity-1" });
    getDatabase.mockResolvedValue({ ...transaction, $transaction: async (work: (value: typeof transaction) => unknown) => work(transaction) });
  });

  it.each(["summaryZh", "summaryEn"] as const)("accepts a 1000-character %s without truncation", async (field) => {
    findUnique.mockResolvedValue({ ...validDraft(), [field]: "文".repeat(1000) });
    await expect(create().convert("draft-1")).resolves.toMatchObject({ status: "CONVERTED" });
    expect(createActivity).toHaveBeenCalledWith({ data: expect.objectContaining({ [field]: "文".repeat(1000), visibility: "PRIVATE", featured: false }) });
    expect(update).toHaveBeenCalledWith({ where: { id: "draft-1" }, data: { status: "CONVERTED", convertedActivityId: "activity-1" } });
  });

  it.each([
    ["summaryZh", 1001, "中文摘要不能超过 1000 字"],
    ["summaryZh", 4000, "中文摘要不能超过 1000 字"],
    ["summaryEn", 1001, "英文摘要不能超过 1000 字"],
    ["summaryEn", 4000, "英文摘要不能超过 1000 字"],
    ["titleZh", 121, "中文标题不能超过 120 字"],
    ["titleEn", 121, "英文标题不能超过 120 字"],
  ])("rejects %s of length %s before any writes", async (field, length, message) => {
    const draft = { ...validDraft(), [field]: "文".repeat(Number(length)) };
    findUnique.mockResolvedValue(draft);
    await expect(create().convert("draft-1")).rejects.toThrow(String(message));
    expect(createActivity).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(draft.status).toBe("DRAFT");
  });

  it("revalidates the latest draft inside the conversion transaction", async () => {
    findUnique.mockResolvedValueOnce(validDraft()).mockResolvedValueOnce({ ...validDraft(), summaryZh: "长".repeat(1001) });
    await expect(create().convert("draft-1")).rejects.toThrow("中文摘要不能超过 1000 字");
    expect(createActivity).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("uses the current text and date read inside the transaction", async () => {
    const latest = new Date("2026-09-21T00:00:00Z");
    findUnique.mockResolvedValueOnce(validDraft()).mockResolvedValueOnce({ ...validDraft(), titleZh: " 最新标题 ", weekEnd: latest, occurredAt: latest });
    await create().convert("draft-1");
    expect(createActivity).toHaveBeenCalledWith({ data: expect.objectContaining({ titleZh: "最新标题", occurredAt: latest }) });
  });

  it("does not create again if another request has converted the draft", async () => {
    findUnique.mockResolvedValueOnce(validDraft()).mockResolvedValueOnce({ ...validDraft(), status: "CONVERTED" });
    await expect(create().convert("draft-1")).rejects.toThrow("已经转换");
    expect(createActivity).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps the draft editable when activity creation fails", async () => {
    createActivity.mockRejectedValue(new Error("数据库写入失败"));
    await expect(create().convert("draft-1")).rejects.toThrow("数据库写入失败");
    expect(update).not.toHaveBeenCalled();
  });

  it("normalizes empty optional English copy for a private activity", async () => {
    findUnique.mockResolvedValue({ ...validDraft(), titleEn: " ", summaryEn: " " });
    await create().convert("draft-1");
    expect(createActivity).toHaveBeenCalledWith({ data: expect.objectContaining({ titleEn: null, summaryEn: null, visibility: "PRIVATE" }) });
  });
});
