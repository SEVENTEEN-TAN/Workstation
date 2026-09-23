import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicReadiness } from "../src/components/admin/okr/PublicReadiness";
import {
  getCareerActivityPublicIssues,
  getExperiencePublicIssues,
  getPortfolioProjectPublicIssues,
  getResumeFilePublicIssues,
  getSkillAreaPublicIssues,
  getSkillAreaPublicNotes,
} from "../src/lib/public-readiness";

const project = {
  id: "project-public",
  slug: "public-project",
  titleZh: "公开项目",
  titleEn: "Public Project",
  summaryEn: "Summary",
  contextEn: "Context",
  responsibilityEn: "Responsibility",
  challengeEn: "Challenge",
  approachEn: "Approach",
  resultEn: "Result",
  coverImage: "/cover.webp",
  coverAltEn: "Cover",
  links: [{ labelZh: "站点", labelEn: "Website" }],
  visibility: "PUBLIC" as const,
};

describe("admin public readiness", () => {
  it("shows project destination and publication steps without hiding blockers", () => {
    const markup = renderToStaticMarkup(createElement(PublicReadiness, {
      issues: getPortfolioProjectPublicIssues({ ...project, visibility: "PRIVATE" }),
      destination: "项目页 /projects",
      nextStep: "首页卡片另需同步、保存草稿并发布",
    }));

    expect(markup).toContain("暂不在前台展示");
    expect(markup).toContain("当前设为私密");
    expect(markup).toContain("展示去向：项目页 /projects");
    expect(markup).toContain("生效步骤：首页卡片另需同步、保存草稿并发布");
  });

  it("reports every project field that prevents public display", () => {
    expect(getPortfolioProjectPublicIssues({
      ...project,
      visibility: "PRIVATE",
      titleEn: " ",
      summaryEn: null,
      contextEn: null,
      responsibilityEn: null,
      challengeEn: null,
      approachEn: null,
      resultEn: null,
      coverAltEn: null,
      links: [{ labelZh: "源码", labelEn: null }],
    })).toEqual([
      "当前设为私密",
      "缺少英文标题",
      "缺少英文摘要",
      "缺少英文项目背景",
      "缺少英文职责",
      "缺少英文挑战",
      "缺少英文方案",
      "缺少英文结果",
      "缺少英文封面替代文本",
      "链接「源码」缺少英文名称",
    ]);
    expect(getPortfolioProjectPublicIssues(project)).toEqual([]);
  });

  it("reports experience and career translation requirements", () => {
    expect(getExperiencePublicIssues({
      visibility: "PRIVATE",
      organizationEn: null,
      titleEn: null,
      descriptionEn: null,
      locationZh: "上海",
      locationEn: null,
    })).toEqual([
      "当前设为私密",
      "缺少英文机构名称",
      "缺少英文职位或专业",
      "缺少英文描述",
      "缺少英文地点",
    ]);
    expect(getCareerActivityPublicIssues({ visibility: "PUBLIC", titleEn: null, summaryEn: " " }))
      .toEqual(["缺少英文标题", "缺少英文摘要"]);
  });

  it("separates a blocked skill area from child content omitted on the public page", () => {
    const area = {
      visibility: "PUBLIC",
      nameEn: "Backend",
      descriptionEn: "Backend skills",
      skills: [{
        nameZh: "Java",
        nameEn: "Java",
        summaryEn: "Services",
        visibility: "PUBLIC",
        evidence: [
          { kind: "ARTICLE" as const, titleZh: "复盘", titleEn: "Review" },
          { kind: "PROJECT" as const, projectId: "project-private" },
        ],
      }],
    };
    const projects = [project, { ...project, id: "project-private", titleZh: "私密项目", visibility: "PRIVATE" as const }];

    expect(getSkillAreaPublicIssues(area, projects)).toEqual([]);
    expect(getSkillAreaPublicNotes(area, projects)).toEqual([
      "技能「Java」的项目证据「私密项目」：关联项目当前设为私密",
    ]);
    const blockedArea = {
      ...area,
      skills: [{ ...area.skills[0], summaryEn: null, evidence: [{ kind: "PROJECT" as const, projectId: "missing" }] }],
    };
    expect(getSkillAreaPublicIssues(blockedArea, projects)).toEqual(["没有满足前台展示条件的公开技能"]);
    expect(getSkillAreaPublicNotes(blockedArea, projects)).toEqual([
      "技能「Java」暂不展示：缺少英文说明、没有可在前台展示的证据",
      "技能「Java」的项目证据「missing」：关联项目不存在",
    ]);
  });

  it("explains resume slots without exposing storage metadata", () => {
    expect(getResumeFilePublicIssues(null)).toEqual(["尚未上传文件"]);
    expect(getResumeFilePublicIssues({ visibility: "PRIVATE" })).toEqual(["当前设为私密"]);
    expect(getResumeFilePublicIssues({ visibility: "PUBLIC" })).toEqual([]);
  });
});
