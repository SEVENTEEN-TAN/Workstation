import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  fallbackSiteContent,
  toPublicPortfolioProject,
  toRecentProjectViews,
} from "../src/components/public/data";
import { ProjectExperience } from "../src/components/public/ProjectExperience";

const sourceProject = {
  id: "project-1",
  slug: "personal-workstation",
  titleZh: "个人工作站",
  titleEn: "Personal Workstation",
  summaryZh: "可持续更新的在线职业档案。",
  summaryEn: "A sustainable online career profile.",
  contextZh: "职业证据需要统一展示。",
  contextEn: "Career evidence needed one home.",
  responsibilityZh: "负责产品、架构与实现。",
  responsibilityEn: "Owned product, architecture and implementation.",
  challengeZh: "平衡公开展示与私密管理。",
  challengeEn: "Balance public presentation with private administration.",
  approachZh: "使用结构化内容模型。",
  approachEn: "Used structured content models.",
  resultZh: "形成可验证的项目证据。",
  resultEn: "Produced verifiable project evidence.",
  coverImage: "/images/projects/workstation.webp",
  coverAltZh: "个人工作站界面",
  coverAltEn: "Personal Workstation interface",
  technologies: ["Next.js", "TypeScript", "Prisma", "SQLite"],
  links: [
    { kind: "WEBSITE", labelZh: "线上站点", labelEn: "Live site", url: "https://sqtan.com" },
    { kind: "SOURCE", labelZh: "源码", labelEn: "Source", url: "https://github.com/example/repo" },
  ],
  visibility: "PUBLIC",
  featured: true,
  sortOrder: 1,
  startedAt: new Date("2026-09-01T00:00:00.000Z"),
  completedAt: null,
  createdAt: new Date("2026-09-15T00:00:00.000Z"),
  updatedAt: new Date("2026-09-16T00:00:00.000Z"),
} as const;

describe("public portfolio project presentation", () => {
  it("maps structured projects into localized homepage cards", () => {
    const project = toPublicPortfolioProject(sourceProject);

    expect(toRecentProjectViews("en", [project], fallbackSiteContent.en.projects)).toEqual([
      expect.objectContaining({
        slug: "personal-workstation",
        image: "/images/projects/workstation.webp",
        category: "Next.js",
        title: "Personal Workstation",
        description: "A sustainable online career profile.",
        tags: ["Next.js", "TypeScript", "Prisma", "SQLite"],
        alt: "Personal Workstation interface",
      }),
    ]);
  });

  it("keeps CMS snapshot projects as the homepage fallback", () => {
    const views = toRecentProjectViews("zh", [], fallbackSiteContent.zh.projects);

    expect(views).toHaveLength(fallbackSiteContent.zh.projects.length);
    expect(views[0]).toEqual(expect.objectContaining({
      slug: null,
      image: fallbackSiteContent.zh.projects[0].image,
      title: fallbackSiteContent.zh.projects[0].title,
    }));
  });

  it("renders public list and evidence detail routes with working links", () => {
    const project = toPublicPortfolioProject(sourceProject);
    const list = renderToStaticMarkup(createElement(ProjectExperience, {
      content: fallbackSiteContent,
      projects: [project],
    }));
    const detail = renderToStaticMarkup(createElement(ProjectExperience, {
      content: fallbackSiteContent,
      projects: [project],
      project,
    }));

    expect(list).toContain('href="/projects/personal-workstation"');
    expect(detail).toContain("Career evidence needed one home.");
    expect(detail).toContain("Owned product, architecture and implementation.");
    expect(detail).toContain("Balance public presentation with private administration.");
    expect(detail).toContain("Used structured content models.");
    expect(detail).toContain("Produced verifiable project evidence.");
    expect(detail).toContain('href="https://github.com/example/repo"');
  });
});
