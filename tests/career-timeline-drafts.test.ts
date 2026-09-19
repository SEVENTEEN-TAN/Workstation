import { describe, expect, it, vi } from "vitest";

import {
  buildCareerTimelineDrafts,
  createCareerTimelineDraftService,
  type CareerTimelineDraftRepository,
  type CareerTimelineSources,
} from "../src/lib/services/career-timeline-drafts";

const occurredAt = new Date("2026-09-18T04:00:00.000Z");

function sources(overrides: Partial<CareerTimelineSources> = {}): CareerTimelineSources {
  return { articles: [], projects: [], activities: [], milestones: [], ...overrides };
}

function repository(overrides: Partial<CareerTimelineDraftRepository> = {}): CareerTimelineDraftRepository {
  return {
    listDrafts: vi.fn(async () => []),
    timelineSources: vi.fn(async () => sources()),
    createMissingDrafts: vi.fn(async (drafts) => drafts),
    findDraft: vi.fn(async () => null),
    updateDraft: vi.fn(async (_id, value) => ({ id: "draft-1", ...value })),
    convertDraft: vi.fn(async () => ({ id: "draft-1", status: "CONVERTED", convertedActivityId: "activity-new" })),
    ...overrides,
  };
}

describe("career timeline draft generation", () => {
  it("maps articles, completed projects, manual activities, and OKR milestones to stable source keys", () => {
    const drafts = buildCareerTimelineDrafts(sources({
      articles: [{ id: "article-1", title: "工作站架构", summary: "记录架构决策", publishedAt: occurredAt }],
      projects: [
        { id: "project-1", titleZh: "个人工作站", titleEn: "Personal Workstation", summaryZh: "完成 V3 自动化", summaryEn: "Shipped V3 automation", completedAt: occurredAt },
        { id: "project-open", titleZh: "进行中的项目", titleEn: null, summaryZh: "尚未完成", summaryEn: null, completedAt: null },
      ],
      activities: [{ id: "activity-1", titleZh: "技术分享", titleEn: "Tech talk", summaryZh: "分享工作站实践", summaryEn: "Shared workstation lessons", occurredAt }],
      milestones: [{ id: "milestone-1", titleZh: "完成关键结果", titleEn: "Key result completed", summaryZh: "完成自动化闭环", summaryEn: "Completed the automation loop", occurredAt }],
    }));

    expect(drafts.map(({ sourceKey, kind }) => ({ sourceKey, kind }))).toEqual([
      { sourceKey: "ARTICLE:article-1", kind: "ARTICLE" },
      { sourceKey: "PROJECT_COMPLETED:project-1", kind: "PROJECT_COMPLETED" },
      { sourceKey: "ACTIVITY:activity-1", kind: "ACTIVITY" },
      { sourceKey: "OKR_MILESTONE:milestone-1", kind: "OKR_MILESTONE" },
    ]);
    expect(drafts[0]).toMatchObject({ titleZh: "发布文章：工作站架构", titleEn: "Article published: 工作站架构" });
  });

  it("creates only source drafts that do not already exist", async () => {
    const repo = repository({
      timelineSources: vi.fn(async () => sources({
        activities: [{ id: "activity-1", titleZh: "技术分享", titleEn: null, summaryZh: "实践总结", summaryEn: null, occurredAt }],
      })),
    });

    await createCareerTimelineDraftService(repo).sync();

    expect(repo.createMissingDrafts).toHaveBeenCalledWith([
      expect.objectContaining({ sourceKey: "ACTIVITY:activity-1", occurredAt }),
    ]);
  });
});

describe("career timeline draft approval", () => {
  it("returns the admin list as JSON-safe timeline draft views", async () => {
    const repo = repository({
      listDrafts: vi.fn(async () => [{
        id: "draft-1",
        sourceKey: "ACTIVITY:activity-1",
        kind: "ACTIVITY",
        status: "DRAFT",
        titleZh: "技术分享",
        titleEn: "Tech talk",
        summaryZh: "分享工作站实践",
        summaryEn: "Shared workstation lessons",
        occurredAt,
        sourceSnapshot: { id: "activity-1", occurredAt },
        convertedActivityId: null,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      }]),
    });

    await expect(createCareerTimelineDraftService(repo).list()).resolves.toEqual([{
      id: "draft-1",
      sourceKey: "ACTIVITY:activity-1",
      kind: "ACTIVITY",
      status: "DRAFT",
      titleZh: "技术分享",
      titleEn: "Tech talk",
      summaryZh: "分享工作站实践",
      summaryEn: "Shared workstation lessons",
      occurredAt: "2026-09-18T04:00:00.000Z",
      sourceSnapshot: { id: "activity-1", occurredAt: "2026-09-18T04:00:00.000Z" },
      convertedActivityId: null,
      createdAt: "2026-09-18T04:00:00.000Z",
      updatedAt: "2026-09-18T04:00:00.000Z",
    }]);
  });

  it("edits only open drafts", async () => {
    const repo = repository({ findDraft: vi.fn(async () => ({ id: "draft-1", status: "DRAFT" })) });

    await createCareerTimelineDraftService(repo).update("draft-1", {
      titleZh: "  完成工作站 V3  ", titleEn: " Ship Workstation V3 ",
      summaryZh: " 完成自动化闭环。 ", summaryEn: " Shipped the automation loop. ",
    });

    expect(repo.updateDraft).toHaveBeenCalledWith("draft-1", {
      titleZh: "完成工作站 V3", titleEn: "Ship Workstation V3",
      summaryZh: "完成自动化闭环。", summaryEn: "Shipped the automation loop.",
    });
  });

  it("converts an approved draft into a private non-featured career activity", async () => {
    const repo = repository({
      findDraft: vi.fn(async () => ({
        id: "draft-1", status: "DRAFT", titleZh: "完成工作站 V3", titleEn: "Ship Workstation V3",
        summaryZh: "完成自动化闭环。", summaryEn: "Shipped the automation loop.", occurredAt,
      })),
    });

    await createCareerTimelineDraftService(repo).convert("draft-1");

    expect(repo.convertDraft).toHaveBeenCalledWith("draft-1", expect.objectContaining({
      visibility: "PRIVATE", featured: false, linkUrl: null,
    }));
  });
});
