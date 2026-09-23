import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CareerTimelineDraftWorkspace } from "../src/components/admin/CareerTimelineDraftWorkspace";
import { OkrMilestoneDraftWorkspace } from "../src/components/admin/OkrMilestoneDraftWorkspace";
import { WeeklyActivityWorkspace } from "../src/components/admin/WeeklyActivityWorkspace";
import * as workspaceUtils from "../src/components/admin/workspace-utils";
import type { CareerTimelineDraftData } from "../src/lib/services/career-timeline-drafts";
import type { OkrMilestoneDraftData } from "../src/lib/services/okr-milestone-drafts";
import type { WeeklyActivityDraftData } from "../src/lib/services/weekly-activity-drafts";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));

const timestamp = "2026-09-22T00:00:00.000Z";
const converted = { status: "CONVERTED" as const, convertedActivityId: "activity-1" };
const weekly: WeeklyActivityDraftData = {
  id: "weekly-1", weekStart: timestamp, weekEnd: timestamp, ...converted,
  titleZh: "周报", titleEn: "Weekly", summaryZh: "周报摘要", summaryEn: "Weekly summary",
  sourceSnapshot: { github: [], progress: [], actions: [], projects: [], articles: [], activities: [] },
  generatedAt: timestamp, createdAt: timestamp, updatedAt: timestamp,
};
const milestone: OkrMilestoneDraftData = {
  id: "milestone-1", sourceKey: "kr-1:25", kind: "KR_PROGRESS", ...converted,
  titleZh: "里程碑", titleEn: "Milestone", summaryZh: "里程碑摘要", summaryEn: "Milestone summary",
  occurredAt: timestamp, sourceSnapshot: {}, createdAt: timestamp, updatedAt: timestamp,
};
const timeline: CareerTimelineDraftData = {
  id: "timeline-1", sourceKey: "article-1", kind: "ARTICLE", ...converted,
  titleZh: "时间线", titleEn: "Timeline", summaryZh: "时间线摘要", summaryEn: "Timeline summary",
  occurredAt: timestamp, sourceSnapshot: {}, createdAt: timestamp, updatedAt: timestamp,
};

describe("draft conversion navigation", () => {
  it("builds a target only for a converted draft with a usable ID", () => {
    const href = (workspaceUtils as typeof workspaceUtils & {
      convertedActivityHref: (draft: { status: string; convertedActivityId: string | null }) => string | null;
    }).convertedActivityHref;

    expect(href).toBeTypeOf("function");
    expect(href({ status: "CONVERTED", convertedActivityId: "a&b" })).toBe("/admin/activities?activity=a%26b");
    expect(href({ status: "DRAFT", convertedActivityId: "activity-1" })).toBeNull();
    expect(href({ status: "CONVERTED", convertedActivityId: null })).toBeNull();
    expect(href({ status: "CONVERTED", convertedActivityId: " " })).toBeNull();
  });

  it.each([
    ["weekly", createElement(WeeklyActivityWorkspace, { initialDrafts: [weekly] })],
    ["milestone", createElement(OkrMilestoneDraftWorkspace, { initialDrafts: [milestone] })],
    ["timeline", createElement(CareerTimelineDraftWorkspace, { initialDrafts: [timeline] })],
  ])("keeps a manual target link visible on a converted %s row", (_name, view) => {
    const markup = renderToStaticMarkup(view);
    expect(markup).toContain('href="/admin/activities?activity=activity-1"');
    expect(markup).toContain("打开动态 activity-1");
  });

  it("wires navigation after target validation and guards unsaved editors", () => {
    const files = ["WeeklyActivityWorkspace.tsx", "OkrMilestoneDraftWorkspace.tsx", "CareerTimelineDraftWorkspace.tsx"];
    for (const file of files) {
      const source = readFileSync(new URL(`../src/components/admin/${file}`, import.meta.url), "utf8");
      expect(source).toContain("const target = convertedActivityHref(converted)");
      expect(source).toContain("if (!target)");
      expect(source).toContain("router.push(target)");
      expect(source.indexOf("if (!target)")).toBeLessThan(source.indexOf("router.push(target)"));
      if (file === "WeeklyActivityWorkspace.tsx") {
        expect(source).toContain("当前周报有未保存修改");
      } else {
        expect(source).toContain("请先保存或取消当前编辑，再转换为职业动态");
      }
    }
  });
});
