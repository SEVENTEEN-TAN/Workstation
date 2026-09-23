import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { getCyclePublicIssues, getKeyResultPublicIssues, getObjectivePublicIssues, getReviewPublicIssues } from "../src/lib/okr/public-readiness";
import { createPublicDataService } from "../src/lib/services/public-data";
import { PublicReadiness } from "../src/components/admin/okr/PublicReadiness";

const cycle = { visibility: "PUBLIC", nameEn: "Q3" };
const objective = { visibility: "PUBLIC", titleEn: "Ship", descriptionZh: null, descriptionEn: null, keyResults: [] };
const review = { visibility: "PUBLIC", achievementsEn: "Shipped", problemsEn: "Time", lessonsEn: "Plan", nextActionsEn: "Review" };

describe("shared OKR public readiness", () => {
  it("separates configured visibility from complete cycle requirements", () => {
    expect(getCyclePublicIssues(cycle)).toEqual([]);
    expect(getCyclePublicIssues({ visibility: "PRIVATE", nameEn: " " })).toEqual(["当前设为私密", "缺少周期英文名称"]);
    expect(getObjectivePublicIssues(objective, { ...cycle, visibility: "PRIVATE" })).toEqual(["所属周期：当前设为私密"]);
  });

  it("allows absent descriptions but rejects either one-sided translation", () => {
    expect(getObjectivePublicIssues(objective, cycle)).toEqual([]);
    expect(getObjectivePublicIssues({ ...objective, descriptionZh: "中文" }, cycle)).toEqual(["目标缺少英文说明"]);
    expect(getObjectivePublicIssues({ ...objective, descriptionEn: "English" }, cycle)).toEqual(["目标缺少中文说明"]);
    expect(getObjectivePublicIssues({ ...objective, descriptionZh: "中文", descriptionEn: "English" }, cycle)).toEqual([]);
  });

  it("identifies the exact KR whose translation blocks its objective", () => {
    const keyResult = { titleZh: "完善搜索", titleEn: " ", descriptionZh: "验收", descriptionEn: null };
    expect(getKeyResultPublicIssues(keyResult)).toEqual(["缺少英文标题", "缺少英文说明"]);
    expect(getObjectivePublicIssues({ ...objective, keyResults: [keyResult] }, cycle)).toEqual([
      "KR「完善搜索」：缺少英文标题", "KR「完善搜索」：缺少英文说明",
    ]);
  });

  it("reports each missing review field and the blocked parent cycle", () => {
    expect(getReviewPublicIssues(review, cycle)).toEqual([]);
    expect(getReviewPublicIssues({ visibility: "PUBLIC", achievementsEn: " " }, { ...cycle, nameEn: null })).toEqual([
      "所属周期：缺少周期英文名称", "缺少英文成果", "缺少英文问题", "缺少英文经验", "缺少英文下一步",
    ]);
  });

  it("uses the same reasons to filter actual public records without changing sort order", async () => {
    const date = new Date("2026-09-20T00:00:00Z");
    const visible = { ...objective, id: "visible", titleZh: "公开目标", sortOrder: 2, status: "IN_PROGRESS" };
    const blocked = { ...visible, id: "blocked", titleEn: " " };
    const completeReview = { ...review, id: "review-1", achievementsZh: "成果", problemsZh: "问题", lessonsZh: "经验", nextActionsZh: "下一步", reviewedAt: date };
    const source = { ...cycle, id: "cycle-1", nameZh: "周期", status: "ACTIVE", startDate: date, endDate: date,
      objectives: [visible, blocked, { ...visible, id: "first", sortOrder: 1 }],
      reviews: [completeReview, { ...completeReview, id: "blocked-review", lessonsEn: " " }],
    };
    const service = createPublicDataService({ findPublishedSiteVersion: async () => null,
      findOkrCycles: async () => [source, { ...source, id: "private", visibility: "PRIVATE" }, { ...source, id: "incomplete", nameEn: " " }],
    });
    const result = await service.getPublicOkrData();
    expect(result.map((item) => item.id)).toEqual(["cycle-1"]);
    expect(result[0].objectives.map((item) => item.id)).toEqual(["first", "visible"]);
    expect(result[0].reviews.map((item) => item.id)).toEqual(["review-1"]);
    expect(getObjectivePublicIssues(blocked, cycle)).toEqual(["缺少目标英文标题"]);
  });

  it("renders actionable explanations rather than claiming configured public content is live", () => {
    const blocked = renderToStaticMarkup(createElement(PublicReadiness, { issues: ["缺少周期英文名称"] }));
    expect(blocked).toContain("暂不在前台展示");
    expect(blocked).toContain("缺少周期英文名称");
    const ready = renderToStaticMarkup(createElement(PublicReadiness, { issues: [] }));
    expect(ready).toContain("满足前台展示条件");
    expect(ready).not.toContain("已发布");
    const partial = renderToStaticMarkup(createElement(PublicReadiness, {
      issues: [],
      notes: ["技能「Java」的私密项目证据不会展示"],
    }));
    expect(partial).toContain("满足前台展示条件");
    expect(partial).toContain("部分内容未展示：技能「Java」的私密项目证据不会展示");
  });
});
