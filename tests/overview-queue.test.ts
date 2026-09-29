import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({
  listOkr: vi.fn(),
  listVaults: vi.fn(),
  listSiteVersions: vi.fn(),
}));

vi.mock("../src/lib/services/okr", () => ({
  okrService: { listAll: services.listOkr },
}));

vi.mock("../src/lib/services/knowledge-vaults", () => ({
  knowledgeVaultService: { list: services.listVaults },
}));

vi.mock("../src/lib/services/site-content", () => ({
  getSiteContentService: () => ({ listVersions: services.listSiteVersions }),
}));

import { getOverviewQueue } from "../src/lib/services/overview-queue";

describe("overview queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.listOkr.mockResolvedValue([]);
    services.listVaults.mockResolvedValue([]);
    services.listSiteVersions.mockResolvedValue([]);
  });

  it("uses the Shanghai calendar day for unfinished actions and objective-or-cycle KR deadlines", async () => {
    services.listOkr.mockResolvedValue([{
      id: "cycle-1",
      nameZh: "2026 Q3",
      endDate: new Date("2026-09-28T00:00:00.000Z"),
      objectives: [{
        id: "objective-1",
        titleZh: "交付新版工作站",
        endDate: null,
        keyResults: [{
          id: "kr-overdue",
          titleZh: "完成仪表盘",
          status: "IN_PROGRESS",
          progressMode: "MANUAL",
          manualProgress: 80,
          actionItems: [{ id: "action-today", titleZh: "联调仪表盘", status: "TODO", dueDate: new Date("2026-09-29T00:00:00.000Z") },
            { id: "action-done", titleZh: "已完成事项", status: "DONE", dueDate: new Date("2026-09-29T00:00:00.000Z") },
            { id: "action-cancelled", titleZh: "已取消事项", status: "CANCELLED", dueDate: new Date("2026-09-29T00:00:00.000Z") },
            { id: "action-other-day", titleZh: "明日事项", status: "TODO", dueDate: new Date("2026-09-30T00:00:00.000Z") }],
        }, {
          id: "kr-complete",
          titleZh: "已完成结果",
          status: "COMPLETED",
          progressMode: "MANUAL",
          manualProgress: 80,
          actionItems: [],
        }, {
          id: "kr-at-100",
          titleZh: "进度已满",
          status: "IN_PROGRESS",
          progressMode: "MANUAL",
          manualProgress: 100,
          actionItems: [],
        }],
      }, {
        id: "objective-2",
        titleZh: "目标日期优先",
        endDate: new Date("2026-09-30T00:00:00.000Z"),
        keyResults: [{
          id: "kr-not-overdue",
          titleZh: "尚未到期",
          status: "IN_PROGRESS",
          progressMode: "METRIC",
          startValue: 0,
          currentValue: 1,
          targetValue: 2,
          actionItems: [],
        }],
      }],
    }]);

    const queue = await getOverviewQueue(new Date("2026-09-28T16:30:00.000Z"));

    expect(queue.todayActions).toEqual([{
      id: "action-today",
      label: "联调仪表盘",
      detail: "2026 Q3 / 交付新版工作站 / 完成仪表盘",
      href: "/admin/okr/cycles/cycle-1/objectives/objective-1#action-action-today",
    }]);
    expect(queue.overdueKeyResults).toEqual([{
      id: "kr-overdue",
      label: "完成仪表盘",
      detail: "2026 Q3 / 交付新版工作站 · 截止 2026-09-28 · 80%",
      href: "/admin/okr/cycles/cycle-1/objectives/objective-1#key-result-kr-overdue",
    }]);
  });

  it("reports only undecided modified or missing changes from each latest sync report", async () => {
    services.listVaults.mockResolvedValue([{
      id: "vault-1",
      name: "Personal Tech",
      notes: [],
      sourceRevisions: [],
      syncReports: [{
        id: "latest-report",
        changes: [{ id: "change-modified", type: "MODIFIED", currentRelativePath: "notes/changed.md", previousRelativePath: "notes/changed.md", reviewDecision: null },
          { id: "change-missing", type: "MISSING", currentRelativePath: null, previousRelativePath: "notes/missing.md", reviewDecision: null },
          { id: "change-added", type: "ADDED", currentRelativePath: "notes/new.md", previousRelativePath: null, reviewDecision: null },
          { id: "change-decided", type: "MODIFIED", currentRelativePath: "notes/done.md", previousRelativePath: "notes/done.md", reviewDecision: "ACKNOWLEDGED" }],
      }, {
        id: "historical-report",
        changes: [{ id: "historical-change", type: "MISSING", currentRelativePath: null, previousRelativePath: "notes/old.md", reviewDecision: null }],
      }],
    }]);

    const queue = await getOverviewQueue();

    expect(queue.pendingReviews).toEqual([{
      id: "change-modified",
      label: "notes/changed.md",
      detail: "Personal Tech · 已修改",
      href: "/admin/knowledge?vault=vault-1#sync-change-change-modified",
    }, {
      id: "change-missing",
      label: "notes/missing.md",
      detail: "Personal Tech · 疑似缺失",
      href: "/admin/knowledge?vault=vault-1#sync-change-change-missing",
    }]);
  });

  it("lists changed homepage work and one latest publication item per knowledge path", async () => {
    services.listSiteVersions.mockResolvedValue([{ id: "site-draft", version: 2, status: "DRAFT", content: { hero: { title: "changed" } } },
      { id: "site-published", version: 1, status: "PUBLISHED", content: { hero: { title: "published" } } }]);
    services.listVaults.mockResolvedValue([{
      id: "vault-1",
      name: "Personal Tech",
      notes: [{ relativePath: "notes/a.md" }, { relativePath: "notes/b.md" }, { relativePath: "notes/c.md" }, { relativePath: "notes/d.md" }],
      syncReports: [],
      sourceRevisions: [{
        id: "revision-a-latest", relativePath: "notes/a.md", contentHash: "hash-a2", capturedAt: "2026-09-03T00:00:00.000Z", draft: null,
      }, {
        id: "revision-a-published", relativePath: "notes/a.md", contentHash: "hash-a1", capturedAt: "2026-09-01T00:00:00.000Z",
        draft: { id: "draft-a", title: "Article A", updatedAt: "2026-09-01T00:00:00.000Z", article: { slug: "a", publishedAt: "2026-09-02T00:00:00.000Z" } },
      }, {
        id: "revision-b-latest", relativePath: "notes/b.md", contentHash: "hash-b2", capturedAt: "2026-09-04T00:00:00.000Z",
        draft: { id: "draft-b2", title: "Article B", updatedAt: "2026-09-04T00:00:00.000Z", article: null },
      }, {
        id: "revision-b-old", relativePath: "notes/b.md", contentHash: "hash-b1", capturedAt: "2026-09-02T00:00:00.000Z",
        draft: { id: "draft-b1", title: "Old B", updatedAt: "2026-09-02T00:00:00.000Z", article: null },
      }, {
        id: "revision-c-published", relativePath: "notes/c.md", contentHash: "hash-c2", capturedAt: "2026-09-05T00:00:00.000Z",
        draft: { id: "draft-c2", title: "Article C", updatedAt: "2026-09-05T00:00:00.000Z", article: { slug: "c", publishedAt: "2026-09-05T01:00:00.000Z" } },
      }, {
        id: "revision-c-old", relativePath: "notes/c.md", contentHash: "hash-c1", capturedAt: "2026-09-01T00:00:00.000Z",
        draft: { id: "draft-c1", title: "Old C", updatedAt: "2026-09-01T00:00:00.000Z", article: null },
      }, {
        id: "revision-d", relativePath: "notes/d.md", contentHash: "hash-d", capturedAt: "2026-09-05T00:00:00.000Z", draft: null,
      }],
    }]);

    const queue = await getOverviewQueue();

    expect(queue.pendingPublications).toEqual([{
      id: "site-draft",
      label: "首页草稿待发布",
      detail: "版本 2 有未发布修改",
      href: "/admin/home",
    }, {
      id: "revision-a-latest",
      label: "Article A",
      detail: "Personal Tech / notes/a.md · 已发布内容有更新",
      href: "/admin/knowledge?vault=vault-1&revision=revision-a-latest#revision-revision-a-latest",
    }, {
      id: "revision-b-latest",
      label: "Article B",
      detail: "Personal Tech / notes/b.md · 草稿待发布",
      href: "/admin/knowledge?vault=vault-1&revision=revision-b-latest#revision-revision-b-latest",
    }]);
  });

  it("does not treat an unchanged homepage draft as pending publication", async () => {
    services.listSiteVersions.mockResolvedValue([{ id: "site-draft", version: 2, status: "DRAFT", content: { hero: { title: "same" } } },
      { id: "site-published", version: 1, status: "PUBLISHED", content: { hero: { title: "same" } } }]);

    await expect(getOverviewQueue()).resolves.toMatchObject({ pendingPublications: [] });
  });

  it("lists a homepage draft when no homepage version has been published", async () => {
    services.listSiteVersions.mockResolvedValue([
      { id: "site-draft", version: 1, status: "DRAFT", content: { hero: { title: "first draft" } } },
    ]);

    await expect(getOverviewQueue()).resolves.toMatchObject({
      pendingPublications: [{
        id: "site-draft",
        label: "首页草稿待发布",
        detail: "版本 1 有未发布修改",
        href: "/admin/home",
      }],
    });
  });

  it("ignores object key order when comparing homepage draft content", async () => {
    services.listSiteVersions.mockResolvedValue([
      { id: "site-draft", version: 2, status: "DRAFT", content: { hero: { title: "same", subtitle: "same" } } },
      { id: "site-published", version: 1, status: "PUBLISHED", content: { hero: { subtitle: "same", title: "same" } } },
    ]);

    await expect(getOverviewQueue()).resolves.toMatchObject({ pendingPublications: [] });
  });

  it("does not link a knowledge revision absent from the current note index", async () => {
    services.listVaults.mockResolvedValue([{
      id: "vault-1", name: "Personal Tech", notes: [], syncReports: [],
      sourceRevisions: [{ id: "unavailable", relativePath: "notes/gone.md", contentHash: "hash", capturedAt: "2026-09-29T00:00:00.000Z",
        draft: { id: "draft", title: "Gone", article: null } }],
    }]);

    await expect(getOverviewQueue()).resolves.toMatchObject({ pendingPublications: [] });
  });
});
