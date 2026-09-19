import { describe, expect, it, vi } from "vitest";

import {
  buildCompletionMilestoneDraft,
  buildProgressMilestoneDraft,
  createOkrMilestoneDraftService,
  selectProgressMilestone,
  type OkrMilestoneDraftRepository,
} from "../src/lib/services/okr-milestone-drafts";

function repository(overrides: Partial<OkrMilestoneDraftRepository> = {}): OkrMilestoneDraftRepository {
  return {
    listDrafts: vi.fn(async () => []),
    findDraft: vi.fn(async () => null),
    updateDraft: vi.fn(async (_id, value) => ({ id: "draft-1", ...value })),
    convertDraft: vi.fn(async () => ({ id: "draft-1", status: "CONVERTED", convertedActivityId: "activity-1" })),
    ...overrides,
  };
}

describe("OKR milestone selection", () => {
  it("selects only the highest newly crossed progress threshold", () => {
    expect(selectProgressMilestone(20, 68)).toBe(50);
    expect(selectProgressMilestone(68, 80)).toBe(75);
    expect(selectProgressMilestone(80, 65)).toBeNull();
    expect(selectProgressMilestone(50, 70)).toBeNull();
  });

  it("builds a deterministic progress milestone with a stable source key", () => {
    expect(buildProgressMilestoneDraft({
      keyResultId: "kr-1",
      keyResultTitleZh: "完成工作站自动化",
      keyResultTitleEn: "Ship workstation automation",
      objectiveTitleZh: "完成工作站 V3",
      objectiveTitleEn: "Ship Workstation V3",
      cycleNameZh: "2026 Q3",
      cycleNameEn: "2026 Q3",
      previousProgress: 20,
      progress: 68,
      noteZh: "完成 GitHub 同步和周报草稿",
      noteEn: "Finished GitHub sync and weekly drafts",
      occurredAt: new Date("2026-09-18T02:00:00.000Z"),
    })).toMatchObject({
      sourceKey: "KR_PROGRESS:kr-1:50",
      kind: "KR_PROGRESS",
      titleZh: "完成工作站自动化达到 50%",
      titleEn: "Ship workstation automation reached 50%",
      occurredAt: new Date("2026-09-18T02:00:00.000Z"),
    });
  });

  it("builds stable completion milestones for objectives and key results", () => {
    expect(buildCompletionMilestoneDraft({
      kind: "OBJECTIVE_COMPLETED",
      entityId: "objective-1",
      titleZh: "完成工作站 V3",
      titleEn: "Ship Workstation V3",
      parentZh: "2026 Q3",
      parentEn: "2026 Q3",
      occurredAt: new Date("2026-09-18T03:00:00.000Z"),
    })).toMatchObject({
      sourceKey: "OBJECTIVE_COMPLETED:objective-1",
      titleZh: "完成目标：完成工作站 V3",
    });
  });
});

describe("OKR milestone draft service", () => {
  it("returns the admin list as JSON-safe milestone draft views", async () => {
    const occurredAt = new Date("2026-09-18T03:00:00.000Z");
    const repo = repository({
      listDrafts: vi.fn(async () => [{
        id: "draft-1",
        sourceKey: "KR_PROGRESS:kr-1:50",
        kind: "KR_PROGRESS",
        status: "DRAFT",
        titleZh: "完成工作站自动化达到 50%",
        titleEn: "Ship workstation automation reached 50%",
        summaryZh: "关键结果进度由 20% 提升至 68%。",
        summaryEn: "Key-result progress increased from 20% to 68%.",
        occurredAt,
        sourceSnapshot: { keyResultId: "kr-1", occurredAt },
        convertedActivityId: null,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      }]),
    });

    await expect(createOkrMilestoneDraftService(repo).list()).resolves.toEqual([{
      id: "draft-1",
      sourceKey: "KR_PROGRESS:kr-1:50",
      kind: "KR_PROGRESS",
      status: "DRAFT",
      titleZh: "完成工作站自动化达到 50%",
      titleEn: "Ship workstation automation reached 50%",
      summaryZh: "关键结果进度由 20% 提升至 68%。",
      summaryEn: "Key-result progress increased from 20% to 68%.",
      occurredAt: "2026-09-18T03:00:00.000Z",
      sourceSnapshot: { keyResultId: "kr-1", occurredAt: "2026-09-18T03:00:00.000Z" },
      convertedActivityId: null,
      createdAt: "2026-09-18T03:00:00.000Z",
      updatedAt: "2026-09-18T03:00:00.000Z",
    }]);
  });

  it("edits only open drafts and preserves cleared English copy", async () => {
    const repo = repository({ findDraft: vi.fn(async () => ({ id: "draft-1", status: "DRAFT" })) });
    const service = createOkrMilestoneDraftService(repo);

    await service.update("draft-1", {
      titleZh: "  完成关键阶段  ", titleEn: " ",
      summaryZh: " 已完成主要能力。 ", summaryEn: " ",
    });

    expect(repo.updateDraft).toHaveBeenCalledWith("draft-1", {
      titleZh: "完成关键阶段", titleEn: "",
      summaryZh: "已完成主要能力。", summaryEn: "",
    });
  });

  it("converts an approved milestone into a private non-featured activity", async () => {
    const repo = repository({
      findDraft: vi.fn(async () => ({
        id: "draft-1", status: "DRAFT", titleZh: "完成关键阶段", titleEn: "Milestone reached",
        summaryZh: "完成主要能力。", summaryEn: "Finished the main capabilities.",
        occurredAt: new Date("2026-09-18T03:00:00.000Z"),
      })),
    });
    const service = createOkrMilestoneDraftService(repo);

    await service.convert("draft-1");

    expect(repo.convertDraft).toHaveBeenCalledWith("draft-1", expect.objectContaining({
      visibility: "PRIVATE", featured: false, linkUrl: null,
    }));
  });
});
