import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OverviewWorkspace } from "../src/components/admin/OverviewWorkspace";
import type { DashboardData } from "../src/components/admin/types";
import type { OverviewQueueData } from "../src/lib/services/overview-queue";

const dashboard: DashboardData = {
  cycleCount: 1,
  objectiveCount: 2,
  completedObjectives: 0,
  atRiskObjectives: 1,
  averageProgress: 40,
  objectives: [],
};

function render(queue: OverviewQueueData) {
  return renderToStaticMarkup(createElement(OverviewWorkspace, {
    initialDashboard: dashboard,
    initialAuditLogs: [],
    initialQueue: queue,
  }));
}

describe("overview workspace queue", () => {
  it("shows four queues with full counts and a link for every item", () => {
    const markup = render({
      todayActions: Array.from({ length: 6 }, (_, index) => ({
        id: `action-${index + 1}`,
        label: `今日行动 ${index + 1}`,
        detail: `行动说明 ${index + 1}`,
        href: `/admin/okr/action-${index + 1}`,
      })),
      overdueKeyResults: [{ id: "kr-1", label: "逾期结果", detail: "已逾期 1 天", href: "/admin/okr/kr-1" }],
      pendingReviews: [{ id: "review-1", label: "待审查笔记", detail: "Personal Tech · 已修改", href: "/admin/knowledge#review-1" }],
      pendingPublications: [{ id: "publish-1", label: "首页草稿", detail: "版本 2 有未发布修改", href: "/admin/home" }],
    });

    for (const heading of ["今日行动", "逾期 KR", "待审查", "待发布"]) {
      expect(markup).toContain(heading);
    }
    expect(markup).toContain("6 项");
    expect(markup).toContain("今日行动 5");
    expect(markup).toContain("今日行动 6");
    expect(markup).toContain('href="/admin/okr/kr-1"');
    expect(markup).toContain('href="/admin/knowledge#review-1"');
    expect(markup).toContain('href="/admin/home"');
  });

  it("explains each empty queue", () => {
    const markup = render({
      todayActions: [],
      overdueKeyResults: [],
      pendingReviews: [],
      pendingPublications: [],
    });

    for (const emptyState of ["今天没有到期行动", "没有逾期关键结果", "没有待审查变更", "没有待发布内容"]) {
      expect(markup).toContain(emptyState);
    }
  });
});
