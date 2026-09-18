import { describe, expect, it, vi } from "vitest";

import {
  createWeeklyActivityDraftService,
  normalizeWeeklyRange,
  type WeeklyActivityDraftRepository,
  type WeeklySourceSnapshot,
} from "../src/lib/services/weekly-activity-drafts";

const emptySources = (): WeeklySourceSnapshot => ({
  github: [], progress: [], actions: [], projects: [], articles: [], activities: [],
});

function repository(overrides: Partial<WeeklyActivityDraftRepository> = {}): WeeklyActivityDraftRepository {
  return {
    listDrafts: vi.fn(async () => []),
    findDraftByWeekStart: vi.fn(async () => null),
    selectedRepositories: vi.fn(async () => ["SEVENTEEN-TAN/Workstation"]),
    weeklySources: vi.fn(async () => emptySources()),
    upsertDraft: vi.fn(async (value) => ({ id: "draft-1", status: "DRAFT", ...value })),
    findDraft: vi.fn(async () => null),
    updateDraft: vi.fn(async (_id, value) => ({ id: "draft-1", ...value })),
    convertDraft: vi.fn(async () => ({ id: "draft-1", status: "CONVERTED", convertedActivityId: "activity-1" })),
    ...overrides,
  };
}

describe("weekly date range", () => {
  it("uses inclusive China-local dates and an exclusive query boundary", () => {
    expect(normalizeWeeklyRange({ weekStart: "2026-09-14", weekEnd: "2026-09-20" })).toEqual({
      weekStart: new Date("2026-09-13T16:00:00.000Z"),
      weekEnd: new Date("2026-09-19T16:00:00.000Z"),
      endExclusive: new Date("2026-09-20T16:00:00.000Z"),
    });
  });

  it("rejects reversed and longer-than-seven-day ranges", () => {
    expect(() => normalizeWeeklyRange({ weekStart: "2026-09-20", weekEnd: "2026-09-14" })).toThrow();
    expect(() => normalizeWeeklyRange({ weekStart: "2026-09-01", weekEnd: "2026-09-09" })).toThrow();
  });

  it("rejects calendar dates that JavaScript would otherwise roll forward", () => {
    expect(() => normalizeWeeklyRange({ weekStart: "2026-02-30", weekEnd: "2026-03-01" })).toThrow("日期无效");
  });
});

describe("weekly activity draft service", () => {
  it("queries selected GitHub repositories and saves deterministic source copy", async () => {
    const sources: WeeklySourceSnapshot = {
      ...emptySources(),
      github: [{ id: "gh-1", type: "PushEvent", repository: "SEVENTEEN-TAN/Workstation", url: "https://github.com/SEVENTEEN-TAN/Workstation", occurredAt: new Date("2026-09-16T03:00:00Z") }],
      progress: [{ id: "progress-1", titleZh: "完成工作站 V3", titleEn: "Ship Workstation V3", progress: 80, noteZh: "完成 GitHub 同步", noteEn: "Finished GitHub sync", recordedAt: new Date("2026-09-17T03:00:00Z") }],
      projects: [{ id: "project-1", titleZh: "个人工作站", titleEn: "Personal Workstation", summaryZh: "整合个人内容", summaryEn: "Unified personal content", updatedAt: new Date("2026-09-18T03:00:00Z") }],
    };
    const repo = repository({ weeklySources: vi.fn(async () => sources) });
    const service = createWeeklyActivityDraftService(repo);

    const result = await service.generate({ weekStart: "2026-09-14", weekEnd: "2026-09-20" }) as Record<string, unknown>;

    expect(repo.weeklySources).toHaveBeenCalledWith(
      new Date("2026-09-13T16:00:00.000Z"),
      new Date("2026-09-20T16:00:00.000Z"),
      ["SEVENTEEN-TAN/Workstation"],
    );
    expect(result).toMatchObject({ status: "DRAFT", titleZh: "2026-09-14 至 2026-09-20 周动态", titleEn: "Weekly update · Sep 14–20, 2026" });
    expect(result.summaryZh).toContain("GitHub：1 条贡献事件");
    expect(result.summaryZh).toContain("OKR：1 次进度更新");
    expect(result.summaryZh).toContain("项目：个人工作站");
    expect(result.summaryEn).toContain("GitHub: 1 contribution event");
  });

  it("uses the same week start key when a week is regenerated", async () => {
    const repo = repository();
    const service = createWeeklyActivityDraftService(repo);

    await service.generate({ weekStart: "2026-09-14", weekEnd: "2026-09-20" });
    await service.generate({ weekStart: "2026-09-14", weekEnd: "2026-09-20" });

    const writes = vi.mocked(repo.upsertDraft).mock.calls.map(([value]) => value.weekStart);
    expect(writes).toEqual([
      new Date("2026-09-13T16:00:00.000Z"),
      new Date("2026-09-13T16:00:00.000Z"),
    ]);
  });

  it("refuses to overwrite a week that was already converted", async () => {
    const repo = repository({
      findDraftByWeekStart: vi.fn(async () => ({ id: "draft-1", status: "CONVERTED" })),
    });
    const service = createWeeklyActivityDraftService(repo);

    await expect(service.generate({ weekStart: "2026-09-14", weekEnd: "2026-09-20" }))
      .rejects.toThrow("已转换的周报不能重新生成");
    expect(repo.weeklySources).not.toHaveBeenCalled();
    expect(repo.upsertDraft).not.toHaveBeenCalled();
  });

  it("updates only editable bilingual copy while the draft is open", async () => {
    const repo = repository({
      findDraft: vi.fn(async () => ({ id: "draft-1", status: "DRAFT" })),
    });
    const service = createWeeklyActivityDraftService(repo);

    await service.update("draft-1", {
      titleZh: "  本周进展  ", titleEn: " Weekly progress ",
      summaryZh: " 完成同步。 ", summaryEn: " Finished sync. ",
    });

    expect(repo.updateDraft).toHaveBeenCalledWith("draft-1", {
      titleZh: "本周进展", titleEn: "Weekly progress",
      summaryZh: "完成同步。", summaryEn: "Finished sync.",
    });
  });

  it("keeps cleared English copy compatible with non-null draft columns", async () => {
    const repo = repository({
      findDraft: vi.fn(async () => ({ id: "draft-1", status: "DRAFT" })),
    });
    const service = createWeeklyActivityDraftService(repo);

    await service.update("draft-1", {
      titleZh: "本周进展", titleEn: " ", summaryZh: "完成同步。", summaryEn: " ",
    });

    expect(repo.updateDraft).toHaveBeenCalledWith("draft-1", {
      titleZh: "本周进展", titleEn: "", summaryZh: "完成同步。", summaryEn: "",
    });
  });

  it("converts an approved draft into a private non-featured career activity", async () => {
    const repo = repository({
      findDraft: vi.fn(async () => ({
        id: "draft-1", status: "DRAFT", titleZh: "本周进展", titleEn: "Weekly progress",
        summaryZh: "完成工作站同步。", summaryEn: "Finished workstation sync.", weekEnd: new Date("2026-09-19T16:00:00.000Z"),
      })),
    });
    const service = createWeeklyActivityDraftService(repo);

    await service.convert("draft-1");

    expect(repo.convertDraft).toHaveBeenCalledWith("draft-1", expect.objectContaining({
      titleZh: "本周进展", summaryZh: "完成工作站同步。", visibility: "PRIVATE", featured: false, linkUrl: null,
    }));
  });
});
