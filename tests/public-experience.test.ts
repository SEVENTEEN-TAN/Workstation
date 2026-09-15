import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { fallbackSiteContent } from "../src/components/public/data";
import { ExperienceTimeline } from "../src/components/public/ExperienceTimeline";

const experiences = [
  {
    id: "work-1",
    kind: "WORK",
    organizationZh: "示例科技",
    organizationEn: "Example Technology",
    titleZh: "高级后端工程师",
    titleEn: "Senior Backend Engineer",
    descriptionZh: "负责交易系统架构与核心服务演进。",
    descriptionEn: "Owned trading-system architecture and core service evolution.",
    locationZh: "上海",
    locationEn: "Shanghai",
    linkUrl: "https://example.com",
    startedAt: "2024-03-01T00:00:00.000Z",
    endedAt: null,
    isCurrent: true,
    featured: true,
    sortOrder: 0,
  },
  {
    id: "education-1",
    kind: "EDUCATION",
    organizationZh: "示例大学",
    organizationEn: "Example University",
    titleZh: "计算机科学学士",
    titleEn: "B.Sc. in Computer Science",
    descriptionZh: "主修分布式系统与软件工程。",
    descriptionEn: "Focused on distributed systems and software engineering.",
    locationZh: "杭州",
    locationEn: "Hangzhou",
    linkUrl: null,
    startedAt: "2017-09-01T00:00:00.000Z",
    endedAt: "2021-06-30T00:00:00.000Z",
    isCurrent: false,
    featured: false,
    sortOrder: 1,
  },
] as const;

describe("public experience timeline", () => {
  it("renders bilingual work and education records with dates and links", () => {
    const zh = renderToStaticMarkup(createElement(ExperienceTimeline, {
      content: fallbackSiteContent,
      experiences,
    }));
    const en = renderToStaticMarkup(createElement(ExperienceTimeline, {
      content: fallbackSiteContent,
      experiences,
      initialLocale: "en",
    }));

    expect(zh).toContain("高级后端工程师");
    expect(zh).toContain("计算机科学学士");
    expect(zh).toContain("至今");
    expect(zh).toContain('href="https://example.com"');
    expect(en).toContain("Senior Backend Engineer");
    expect(en).toContain("B.Sc. in Computer Science");
    expect(en).toContain("Present");
  });

  it("renders a useful empty state before any experience is public", () => {
    const markup = renderToStaticMarkup(createElement(ExperienceTimeline, {
      content: fallbackSiteContent,
      experiences: [],
    }));

    expect(markup).toContain("暂时没有公开经历。");
  });
});
