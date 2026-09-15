import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SkillCapabilitiesExperience, type PublicSkillArea } from "../src/components/public/SkillCapabilitiesExperience";
import { bootstrapSiteContent } from "../src/lib/content/bootstrap";

const areas: PublicSkillArea[] = [{
  id: "area-1",
  nameZh: "后端工程",
  nameEn: "Backend Engineering",
  descriptionZh: "构建可靠、可维护的服务端系统。",
  descriptionEn: "Build reliable and maintainable backend systems.",
  skills: [{
    id: "skill-1",
    nameZh: "Java 服务端",
    nameEn: "Java Backend",
    summaryZh: "覆盖服务设计、数据建模与交付。",
    summaryEn: "Covers service design, data modeling and delivery.",
    evidence: [{
      id: "evidence-1",
      kind: "PROJECT",
      titleZh: "个人工作站",
      titleEn: "Personal Workstation",
      url: "/projects/personal-workstation",
    }],
  }],
}];

describe("public skill capability presentation", () => {
  it("renders grouped bilingual skills and project evidence", () => {
    const zh = renderToStaticMarkup(createElement(SkillCapabilitiesExperience, {
      content: bootstrapSiteContent,
      areas,
      initialLocale: "zh",
    }));
    const en = renderToStaticMarkup(createElement(SkillCapabilitiesExperience, {
      content: bootstrapSiteContent,
      areas,
      initialLocale: "en",
    }));

    expect(zh).toContain("后端工程");
    expect(zh).toContain("Java 服务端");
    expect(zh).toContain('href="/projects/personal-workstation"');
    expect(en).toContain("Backend Engineering");
    expect(en).toContain("Java Backend");
    expect(en).toContain("Personal Workstation");
  });

  it("renders a bilingual empty state", () => {
    const zh = renderToStaticMarkup(createElement(SkillCapabilitiesExperience, {
      content: bootstrapSiteContent,
      areas: [],
      initialLocale: "zh",
    }));
    const en = renderToStaticMarkup(createElement(SkillCapabilitiesExperience, {
      content: bootstrapSiteContent,
      areas: [],
      initialLocale: "en",
    }));

    expect(zh).toContain("暂时没有公开能力域");
    expect(en).toContain("No public capability areas yet");
  });
});
