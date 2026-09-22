import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HomeExperience } from "../src/components/public/HomeExperience";
import { HomeVisualEditor } from "../src/components/public/HomeVisualEditor";
import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import type { PublicResumeData } from "../src/lib/services/public-resume";

const previewData = {
  content: bootstrapSiteContent,
  activities: [{
    id: "activity-preview",
    titleZh: "预览动态",
    titleEn: "Preview activity",
    summaryZh: "只读公开动态",
    summaryEn: "Read-only public activity",
    occurredAt: "2026-09-22T00:00:00.000Z",
    visibility: "PUBLIC",
    featured: true,
    linkUrl: null,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  }],
  projects: [],
  skills: [],
  experiences: [],
  downloads: { zh: true, en: false },
} satisfies PublicResumeData;

function sectionPositions(markup: string) {
  return ["identity", "about", "now", "work", "capability", "journey", "contact"]
    .map((id) => markup.indexOf(`id="${id}"`));
}

describe("public homepage composition", () => {
  it("marks every CMS-owned public section only in editor mode", () => {
    const editorMarkup = renderToStaticMarkup(createElement(HomeExperience, {
      content: bootstrapSiteContent,
      editor: true,
      locale: "en",
      onLocaleChange: () => undefined,
    }));
    const publicMarkup = renderToStaticMarkup(createElement(HomeExperience, {
      content: bootstrapSiteContent,
      locale: "en",
      onLocaleChange: () => undefined,
    }));

    for (const path of [
      "en.nav.brand",
      "en.hero.work",
      "settings.portraitImage",
      "en.about.heading.0",
      "en.about.stats.0.value",
      "en.works.heading",
      "en.services.items.0.1",
      "en.footer.github",
      "settings.email",
      "settings.githubUrl",
      "settings.wechatQrImage",
    ]) {
      expect(editorMarkup).toContain(`data-cms-path="${path}"`);
      expect(publicMarkup).not.toContain(`data-cms-path="${path}"`);
    }
    expect(editorMarkup).not.toContain('data-cms-path="activities.');
    expect(editorMarkup).not.toContain('data-cms-path="experiences.');
  });

  it("renders the complete homepage from public resume data", () => {
    const markup = renderToStaticMarkup(createElement(HomeVisualEditor, { initialData: previewData }));

    expect(markup).toContain("Preview activity");
    expect(markup).toContain('id="now"');
  });

  it("uses an editor-controlled locale without changing public caller defaults", () => {
    const markup = renderToStaticMarkup(createElement(HomeExperience, {
      content: bootstrapSiteContent,
      locale: "zh",
      onLocaleChange: () => undefined,
    }));

    expect(markup).toContain(bootstrapSiteContent.zh.hero.lineOne);
  });

  it("presents identity, current work, proof, capability, journey and contact in order", () => {
    const markup = renderToStaticMarkup(createElement(HomeExperience, {
      content: bootstrapSiteContent,
      activities: [{
        id: "activity-1",
        titleZh: "发布个人工作站",
        titleEn: "Shipped the personal workstation",
        summaryZh: "完成公开主页与管理后台。",
        summaryEn: "Completed the public site and administration workspace.",
        occurredAt: "2026-09-16T00:00:00.000Z",
        visibility: "PUBLIC",
        featured: true,
        linkUrl: "/projects/personal-workstation",
        createdAt: "2026-09-16T00:00:00.000Z",
        updatedAt: "2026-09-16T00:00:00.000Z",
      }],
      skills: [{
        id: "engineering",
        nameZh: "工程能力",
        nameEn: "Engineering",
        descriptionZh: "以项目结果验证能力。",
        descriptionEn: "Capability backed by project outcomes.",
        skills: [{
          id: "typescript",
          nameZh: "TypeScript",
          nameEn: "TypeScript",
          summaryZh: "构建可靠的全栈应用。",
          summaryEn: "Build reliable full-stack applications.",
          evidence: [{
            id: "evidence-1",
            kind: "PROJECT",
            titleZh: "个人工作站",
            titleEn: "Personal Workstation",
            url: "/projects/personal-workstation",
          }],
        }],
      }],
      experiences: [{
        id: "experience-1",
        kind: "WORK",
        organizationZh: "示例团队",
        organizationEn: "Example Team",
        titleZh: "全栈工程师",
        titleEn: "Full-stack Engineer",
        descriptionZh: "负责核心系统建设。",
        descriptionEn: "Owned core system delivery.",
        locationZh: null,
        locationEn: null,
        linkUrl: null,
        startedAt: "2024-01-01T00:00:00.000Z",
        endedAt: null,
        isCurrent: true,
        featured: true,
        sortOrder: 0,
        visibility: "PUBLIC",
        createdAt: "2026-09-16T00:00:00.000Z",
        updatedAt: "2026-09-16T00:00:00.000Z",
      }],
      resumeDownloads: { zh: true, en: false },
    }));

    const positions = sectionPositions(markup);
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(markup).toContain("Shipped the personal workstation");
    expect(markup).toContain("Engineering");
    expect(markup).toContain("Example Team");
    expect(markup).toContain("03 — JAVA + AI PROJECTS");
    expect(markup).toContain("04 — CAPABILITY");
    expect(markup).toContain("05 — JOURNEY");
    expect(markup).toContain("06 — CONTACT");
  });

  it("keeps the existing service presentation as the capability fallback", () => {
    const markup = renderToStaticMarkup(createElement(HomeExperience, {
      content: bootstrapSiteContent,
      activities: [],
      skills: [],
      experiences: [],
      resumeDownloads: { zh: false, en: false },
    }));

    expect(markup).toContain('id="capability"');
    expect(markup).toContain("04 — TECHNOLOGY");
    expect(markup).toContain("JavaSE, collections");
  });
});
