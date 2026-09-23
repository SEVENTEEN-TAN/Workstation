import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminActivitiesPage from "../src/app/admin/(workspace)/activities/page";
import { careerActivityService, type CareerActivityData } from "../src/lib/services/career-activities";

const activities: CareerActivityData[] = [
  {
    id: "activity-1",
    titleZh: "动态一",
    titleEn: "First activity",
    summaryZh: "第一条摘要",
    summaryEn: "First summary",
    occurredAt: "2026-09-21T00:00:00.000Z",
    visibility: "PRIVATE",
    featured: false,
    linkUrl: null,
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  },
  {
    id: "activity-2",
    titleZh: "动态二",
    titleEn: "Second activity",
    summaryZh: "第二条摘要",
    summaryEn: "Second summary",
    occurredAt: "2026-09-22T00:00:00.000Z",
    visibility: "PRIVATE",
    featured: false,
    linkUrl: null,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  },
];

async function renderPage(activity?: string | string[]) {
  vi.spyOn(careerActivityService, "list").mockResolvedValue(activities);
  const page = await AdminActivitiesPage({ searchParams: Promise.resolve({ activity }) });
  return renderToStaticMarkup(createElement("main", null, page));
}

afterEach(() => vi.restoreAllMocks());

describe("admin career activity target", () => {
  it("opens the editor for the exact loaded activity ID", async () => {
    const markup = await renderPage("activity-2");

    expect(markup).toContain("编辑职业动态");
    expect(markup).toContain('name="titleZh"');
    expect(markup).toContain('value="动态二"');
    expect(markup).not.toContain('value="动态一"');
  });

  it.each([
    ["missing", undefined],
    ["repeated", ["activity-1", "activity-2"]],
    ["blank", "   "],
    ["oversized", "x".repeat(129)],
    ["unknown", "activity-3"],
  ])("keeps the list view for %s target", async (_name, activity) => {
    const markup = await renderPage(activity);

    expect(markup).not.toContain("编辑职业动态");
    expect(markup).not.toContain('name="titleZh"');
    expect(markup).toContain("动态记录");
  });
});
