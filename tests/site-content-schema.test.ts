import { describe, expect, it } from "vitest";

import { siteContentSchema } from "../src/lib/content/schema";

const locale = {
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

describe("siteContentSchema", () => {
  it("accepts a complete bilingual site snapshot", () => {
    expect(siteContentSchema.safeParse({ en: locale, zh: locale }).success).toBe(true);
  });

  it("supplies deterministic settings for legacy snapshots", () => {
    expect(siteContentSchema.parse({ en: locale, zh: locale }).settings).toEqual({
      portraitImage: "/images/zedian-portrait-v3.png",
      wechatQrImage: "/images/wechat-qr.png",
      email: "m13145215766@163.com",
      githubUrl: "https://github.com/SEVENTEEN-TAN",
    });
  });

  it("rejects remote homepage images", () => {
    expect(siteContentSchema.safeParse({
      en: locale,
      zh: locale,
      settings: {
        portraitImage: "https://example.com/portrait.png",
        wechatQrImage: "/images/wechat-qr.png",
        email: "m13145215766@163.com",
        githubUrl: "https://github.com/SEVENTEEN-TAN",
      },
    }).success).toBe(false);
  });

  it("distinguishes legacy projects from explicit structured selections", () => {
    const legacy = { en: locale, zh: locale };

    expect(siteContentSchema.parse(legacy).selectedProjectIds).toBeUndefined();
    expect(siteContentSchema.parse({ ...legacy, selectedProjectIds: [] }).selectedProjectIds).toEqual([]);
    expect(siteContentSchema.parse({
      ...legacy,
      en: { ...locale, projects: [{ ...locale.projects[0], slug: "personal-workstation" }] },
      zh: { ...locale, projects: [{ ...locale.projects[0], slug: "personal-workstation" }] },
    }).en.projects[0].slug).toBe("personal-workstation");
    expect(siteContentSchema.safeParse({ ...legacy, selectedProjectIds: ["p1", "p1"] }).success).toBe(false);
  });

  it("rejects a snapshot missing a required locale section", () => {
    const incompleteZh = { ...locale } as Partial<typeof locale>;
    delete incompleteZh.services;
    expect(siteContentSchema.safeParse({ en: locale, zh: incompleteZh }).success).toBe(false);
  });

  it("rejects empty required text and incomplete projects", () => {
    const invalid = {
      en: { ...locale, meta: { ...locale.meta, title: "" } },
      zh: { ...locale, projects: [{ image: "/project.webp" }] },
    };
    expect(siteContentSchema.safeParse(invalid).success).toBe(false);
  });
});
