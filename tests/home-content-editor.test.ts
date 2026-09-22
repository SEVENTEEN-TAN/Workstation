import { describe, expect, it } from "vitest";

import {
  SITE_SECTION_IDS,
  isSiteContentDirty,
  moveHomepageProjectSelection,
  updateHomepageProjectSelection,
  updateContentAtPath,
  updateVisualContent,
  validateSiteContent,
} from "../src/components/admin/home/content-editor";
import { siteContentSchema, type SiteContent } from "../src/lib/content/schema";

const locale: SiteContent["en"] = {
  meta: { title: "Title", description: "Description" },
  nav: {
    brand: "Brand",
    about: "About",
    work: "Work",
    contact: "Contact",
    top: "Top",
    goContact: "Contact",
    switchLanguage: "Switch",
    switchLabel: "ZH",
  },
  hero: {
    backdrop: "Backdrop",
    role: "Engineer",
    lineOne: "Line one",
    lineTwo: "Line two",
    headingLabel: "Heading",
    intro: "Intro",
    work: "Work",
    contact: "Contact",
    badgeArea: "Badge area",
    badgeLabel: "Badge label",
    portraitAlt: "Portrait",
    badgeRole: "Engineer",
    active: "Active",
  },
  about: {
    eyebrow: "About",
    heading: ["Build", "Systems"],
    headingLabel: "Build systems",
    paragraphs: ["Paragraph"],
    stats: [{ value: "10", accent: "+", label: "Years" }],
    toolkit: "Toolkit",
    skillCount: "1 skill",
    skills: ["TypeScript"],
    quote: "Quote",
  },
  works: {
    eyebrow: "Works",
    heading: "Selected",
    viewAll: "View all",
    explore: "Explore",
    navigation: "Navigation",
    project: "Project",
    showProject: "Show project",
  },
  services: {
    eyebrow: "Services",
    headingStart: "What",
    headingOutline: "I do",
    headingLabel: "What I do",
    items: [["Development", "Description"]],
  },
  footer: {
    backdrop: "Contact",
    eyebrow: "Contact",
    heading: ["Let's", "talk"],
    headingLabel: "Let's talk",
    intro: "Intro",
    menu: "Menu",
    socials: "Socials",
    links: ["About"],
    github: "GitHub",
    wechat: "WeChat",
    wechatHint: "Open QR",
    wechatAlt: "QR code",
    copyright: "Copyright",
    privacy: "Privacy",
    terms: "Terms",
  },
  projects: [
    {
      image: "/project.webp",
      category: "Web / 2026",
      title: "Project",
      description: "Description",
      tags: ["Next.js"],
      alt: "Project preview",
    },
  ],
};

const createContent = (): SiteContent => ({
  en: structuredClone(locale),
  zh: structuredClone(locale),
});

describe("homepage content editor contracts", () => {
  it("exposes sections in the editor order", () => {
    expect(SITE_SECTION_IDS).toEqual([
      "meta",
      "nav",
      "hero",
      "about",
      "works",
      "services",
      "footer",
      "projects",
    ]);
  });

  it("updates a scalar without mutating the original content", () => {
    const content = createContent();

    const updated = updateContentAtPath(content, ["en", "hero", "lineOne"], "New line");

    expect(updated.en.hero.lineOne).toBe("New line");
    expect(content.en.hero.lineOne).toBe("Line one");
    expect(updated).not.toBe(content);
    expect(updated.en.hero).not.toBe(content.en.hero);
  });

  it("updates an array item without mutating the original array", () => {
    const content = createContent();

    const updated = updateContentAtPath(
      content,
      ["zh", "about", "paragraphs", 0],
      "Updated paragraph",
    );

    expect(updated.zh.about.paragraphs).toEqual(["Updated paragraph"]);
    expect(content.zh.about.paragraphs).toEqual(["Paragraph"]);
    expect(updated.zh.about.paragraphs).not.toBe(content.zh.about.paragraphs);
  });

  it("updates current visual collection items immutably and rejects stale indices", () => {
    const content = createContent();
    const updated = updateVisualContent(content, "en.about.paragraphs.0", "Updated paragraph");

    expect(updated.en.about.paragraphs).toEqual(["Updated paragraph"]);
    expect(content.en.about.paragraphs).toEqual(["Paragraph"]);
    expect(updated.en.about.paragraphs).not.toBe(content.en.about.paragraphs);
    expect(() => updateVisualContent(content, "en.about.paragraphs.1", "Stale")).toThrow(/editable/i);
  });

  it("rejects an empty update path", () => {
    expect(() => updateContentAtPath(createContent(), [], "unused")).toThrow(/path/i);
  });

  it("detects equal and changed structural snapshots", () => {
    const savedContent = createContent();
    const equalContent = structuredClone(savedContent);
    const changedContent = updateContentAtPath(savedContent, ["zh", "meta", "title"], "Changed");

    expect(isSiteContentDirty(equalContent, savedContent)).toBe(false);
    expect(isSiteContentDirty(changedContent, savedContent)).toBe(true);
  });

  it("updates homepage project selection without changing materialized cards", () => {
    const content = createContent();
    const updated = updateHomepageProjectSelection(content, ["project-2", "project-1"]);

    expect(updated.selectedProjectIds).toEqual(["project-2", "project-1"]);
    expect(updated.zh.projects).toBe(content.zh.projects);
    expect(updated.en.projects).toBe(content.en.projects);
    expect(isSiteContentDirty(updated, content)).toBe(true);
  });

  it("moves a selected homepage project one position at a time", () => {
    const content = updateHomepageProjectSelection(createContent(), ["project-1", "project-2", "project-3"]);

    const movedUp = moveHomepageProjectSelection(content, 2, "up");
    const invalidMove = moveHomepageProjectSelection(movedUp, 0, "up");

    expect(movedUp.selectedProjectIds).toEqual(["project-1", "project-3", "project-2"]);
    expect(invalidMove.selectedProjectIds).toEqual(["project-1", "project-3", "project-2"]);
    expect(invalidMove).toBe(movedUp);
  });

  it("accepts a valid bilingual snapshot", () => {
    expect(validateSiteContent(createContent())).toEqual({
      valid: true,
      fieldErrors: {},
      sectionErrorCounts: {},
      errorCount: 0,
    });
  });

  it("maps invalid fields in different locales to field and section paths", () => {
    const content = createContent();
    const invalid: SiteContent = {
      ...content,
      en: {
        ...content.en,
        hero: { ...content.en.hero, lineOne: "" },
      },
      zh: {
        ...content.zh,
        projects: [
          { ...content.zh.projects[0], title: "" },
        ],
      },
    };
    const parsed = siteContentSchema.safeParse(invalid);
    if (parsed.success) {
      throw new Error("Expected the invalid fixture to fail schema validation");
    }
    const heroIssue = parsed.error.issues.find(
      (issue) => issue.path.join(".") === "en.hero.lineOne",
    );
    const projectIssue = parsed.error.issues.find(
      (issue) => issue.path.join(".") === "zh.projects.0.title",
    );

    const result = validateSiteContent(invalid);

    expect(heroIssue).toBeDefined();
    expect(projectIssue).toBeDefined();
    expect(result).toEqual({
      valid: false,
      fieldErrors: {
        "en.hero.lineOne": heroIssue?.message,
        "zh.projects.0.title": projectIssue?.message,
      },
      sectionErrorCounts: {
        "en.hero": 1,
        "zh.projects": 1,
      },
      errorCount: 2,
    });
  });
});
