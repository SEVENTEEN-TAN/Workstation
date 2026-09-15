import { describe, expect, it } from "vitest";

import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import {
  findHomepageProjectReferences,
  materializeHomepageProjects,
} from "../src/lib/content/homepage-projects";
import { portfolioProjectInputSchema } from "../src/lib/validators/portfolio-projects";
import type { PortfolioProjectRecord } from "../src/lib/services/portfolio-projects";

const baseProject = portfolioProjectInputSchema.parse({
  slug: "personal-workstation",
  titleZh: "个人工作站",
  titleEn: "Personal Workstation",
  summaryZh: "持续维护的在线职业档案。",
  summaryEn: "A continuously maintained online career profile.",
  contextZh: "需要统一展示职业证据。",
  contextEn: "Career evidence needed one coherent home.",
  responsibilityZh: "负责产品、架构与实现。",
  responsibilityEn: "Owned product, architecture and implementation.",
  challengeZh: "兼顾公开展示与私密管理。",
  challengeEn: "Balance public presentation with private administration.",
  approachZh: "使用 Next.js 与结构化内容模型。",
  approachEn: "Used Next.js with structured content models.",
  resultZh: "形成可持续更新的个人工作站。",
  resultEn: "Delivered a sustainable personal workstation.",
  coverImage: "/images/projects/workstation.webp",
  coverAltZh: "个人工作站项目界面",
  coverAltEn: "Personal Workstation project interface",
  technologies: ["Next.js", "TypeScript"],
  links: [],
  visibility: "PUBLIC",
  featured: true,
  sortOrder: 2,
  startedAt: null,
  completedAt: null,
});

function project(id: string, overrides: Partial<PortfolioProjectRecord> = {}): PortfolioProjectRecord {
  const now = new Date("2026-09-16T00:00:00.000Z");
  return { ...baseProject, id, createdAt: now, updatedAt: now, ...overrides };
}

describe("homepage project materialization", () => {
  it("maps selected projects into ordered bilingual cards", () => {
    const first = project("first", { slug: "first", titleZh: "第一项", titleEn: "First" });
    const second = project("second", { slug: "second", titleZh: "第二项", titleEn: "Second" });
    const content = { ...structuredClone(bootstrapSiteContent), selectedProjectIds: ["second", "first"] };

    expect(materializeHomepageProjects(content, [first, second])).toMatchObject({
      selectedProjectIds: ["second", "first"],
      en: { projects: [
        { slug: "second", title: "Second", category: "Next.js", tags: ["Next.js", "TypeScript"] },
        { slug: "first", title: "First", category: "Next.js", tags: ["Next.js", "TypeScript"] },
      ] },
      zh: { projects: [
        { slug: "second", title: "第二项", category: "Next.js", tags: ["Next.js", "TypeScript"] },
        { slug: "first", title: "第一项", category: "Next.js", tags: ["Next.js", "TypeScript"] },
      ] },
    });
  });

  it("keeps a legacy snapshot unchanged and materializes an explicit empty selection", () => {
    const legacy = structuredClone(bootstrapSiteContent);
    expect(materializeHomepageProjects(legacy, [])).toBe(legacy);

    const content = { ...structuredClone(bootstrapSiteContent), selectedProjectIds: [] };
    const materialized = materializeHomepageProjects(content, []);
    expect(materialized.selectedProjectIds).toEqual([]);
    expect(materialized.en.projects).toEqual([]);
    expect(materialized.zh.projects).toEqual([]);
  });

  it("rejects missing, private, or incomplete public projects", () => {
    const selected = project("selected", { visibility: "PRIVATE" });

    expect(() => materializeHomepageProjects(
      { ...structuredClone(bootstrapSiteContent), selectedProjectIds: ["selected", "missing"] },
      [selected],
    )).toThrow("主页引用的项目不存在或不可公开");
    expect(() => materializeHomepageProjects(
      { ...structuredClone(bootstrapSiteContent), selectedProjectIds: ["incomplete"] },
      [project("incomplete", { titleEn: null })],
    )).toThrow("主页引用的项目不存在或不可公开");
  });

  it("reports versions that explicitly reference a project", () => {
    const referenced = {
      id: "referenced",
      version: 2,
      status: "PUBLISHED",
      content: { ...structuredClone(bootstrapSiteContent), selectedProjectIds: ["project-1"] },
      publishedAt: new Date(),
    };
    const legacy = {
      id: "legacy",
      version: 1,
      status: "ARCHIVED",
      content: structuredClone(bootstrapSiteContent),
      publishedAt: new Date(),
    };
    const emptySelection = {
      id: "empty",
      version: 3,
      status: "DRAFT",
      content: { ...structuredClone(bootstrapSiteContent), selectedProjectIds: [] },
      publishedAt: null,
    };

    expect(findHomepageProjectReferences("project-1", [legacy, referenced, emptySelection]))
      .toEqual([referenced]);
  });
});
