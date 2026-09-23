import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CareerTimelineDraftWorkspace } from "../src/components/admin/CareerTimelineDraftWorkspace";
import { OkrMilestoneDraftWorkspace } from "../src/components/admin/OkrMilestoneDraftWorkspace";
import { WeeklyActivityWorkspace, writeRecovery } from "../src/components/admin/WeeklyActivityWorkspace";
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
      convertedActivityHref: (draft: { status: string; convertedActivityId: unknown }) => string | null;
    }).convertedActivityHref;

    expect(href).toBeTypeOf("function");
    expect(href({ status: "CONVERTED", convertedActivityId: "a&b" })).toBe("/admin/activities?activity=a%26b");
    expect(href({ status: "DRAFT", convertedActivityId: "activity-1" })).toBeNull();
    expect(href({ status: "CONVERTED", convertedActivityId: null })).toBeNull();
    expect(href({ status: "CONVERTED", convertedActivityId: " " })).toBeNull();
  });

  it("rejects an ID the destination refuses instead of navigating to the list", () => {
    expect(workspaceUtils.convertedActivityHref({ status: "CONVERTED", convertedActivityId: "x".repeat(129) })).toBeNull();
  });

  it("treats malformed successful response IDs as missing targets", () => {
    expect(workspaceUtils.convertedActivityHref({ status: "CONVERTED", convertedActivityId: 123 })).toBeNull();
    expect(workspaceUtils.convertedActivityHref({ status: "CONVERTED", convertedActivityId: {} })).toBeNull();
  });

  it("refuses to rely on a recovery copy that browser storage could not save", () => {
    const values = { titleZh: "未保存", titleEn: "Unsaved", summaryZh: "未保存摘要", summaryEn: "Unsaved summary" };
    const setItem = vi.fn(() => { throw new Error("storage unavailable"); });
    vi.stubGlobal("sessionStorage", { setItem });
    try {
      expect(writeRecovery("weekly-1", values, timestamp)).toBe(false);
      expect(setItem).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("confirms a recovery copy was stored before cross-draft conversion", () => {
    const values = { titleZh: "未保存", titleEn: "Unsaved", summaryZh: "未保存摘要", summaryEn: "Unsaved summary" };
    const setItem = vi.fn();
    vi.stubGlobal("sessionStorage", { setItem });
    try {
      expect(writeRecovery("weekly-1", values, timestamp)).toBe(true);
      expect(setItem).toHaveBeenCalledWith("weekly-draft-recovery:weekly-1", JSON.stringify({ values, expectedUpdatedAt: timestamp }));
    } finally {
      vi.unstubAllGlobals();
    }
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

  it("locks editing controls while any conversion request is pending", () => {
    for (const file of ["WeeklyActivityWorkspace.tsx", "OkrMilestoneDraftWorkspace.tsx", "CareerTimelineDraftWorkspace.tsx"]) {
      const source = readFileSync(new URL(`../src/components/admin/${file}`, import.meta.url), "utf8");
      expect(source).toContain("const converting = drafts.some");
      if (file === "WeeklyActivityWorkspace.tsx") {
        expect(source.split("\n").find((line) => line.includes('name="titleZh"'))).toContain("disabled={converting}");
        expect(source.split("\n").find((line) => line.includes('name="summaryZh"'))).toContain("disabled={converting}");
      } else {
        expect(source).toMatch(/onClick=\{\(\) => setEditing\(draft\)\} disabled=\{converting\}/);
      }
    }
  });

  it("blocks a cross-draft conversion before the request when recovery storage fails", () => {
    const source = readFileSync(new URL("../src/components/admin/WeeklyActivityWorkspace.tsx", import.meta.url), "utf8");
    const guard = source.indexOf("if (!writeRecovery(editing.draft.id, editing.values, editing.baseUpdatedAt))");
    const request = source.indexOf("const converted = await runAction(`weekly:convert:");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(request);
  });
});
