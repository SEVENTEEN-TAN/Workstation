import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import { siteContentSchema } from "../src/lib/content/schema";
import { HomeExperience } from "../src/components/public/HomeExperience";
import { selectHomepageRecords } from "../src/lib/content/homepage-composition";

describe("homepage layouts", () => {
  it("persists composition and rejects duplicate or arbitrary sections", () => {
    const composition = { template: "compact", sections: [{ id: "work", visible: true }] };
    expect(siteContentSchema.parse({ ...bootstrapSiteContent, composition }).composition).toEqual(composition);
    expect(siteContentSchema.safeParse({ ...bootstrapSiteContent, composition: { ...composition, sections: [...composition.sections, ...composition.sections] } }).success).toBe(false);
    expect(siteContentSchema.safeParse({ ...bootstrapSiteContent, composition: { ...composition, sections: [{ id: "script", visible: true }] } }).success).toBe(false);
  });
  it("orders only currently public source records; empty selection hides all", () => {
    const records = [{ id: "a" }, { id: "b" }];
    expect(selectHomepageRecords(records, ["b", "missing", "a"])).toEqual([records[1], records[0]]);
    expect(selectHomepageRecords(records, [])).toEqual([]);
    expect(selectHomepageRecords(records, undefined)).toBe(records);
  });
  it("persists manual source selection and does not revive fallback skills when cleared", () => {
    const content = siteContentSchema.parse({ ...bootstrapSiteContent, homepageSelection: { skills: [], activities: ["b", "a"] } });
    expect(content.homepageSelection).toEqual({ skills: [], activities: ["b", "a"] });
    expect(siteContentSchema.safeParse({ ...content, homepageSelection: { activities: ["a", "a"] } }).success).toBe(false);
    const markup = renderToStaticMarkup(createElement(HomeExperience, { content, skills: [], locale: "en" }));
    expect(markup).toContain("SKILLS WITH EVIDENCE.");
    expect(markup).not.toContain(bootstrapSiteContent.en.services.items[0][1]);
  });
  it("renders reordered visible sections and removes hidden navigation and shortcuts", () => {
    const content = siteContentSchema.parse({ ...bootstrapSiteContent, composition: {
      template: "default", sections: [{ id: "contact", visible: true }, { id: "identity", visible: true }, { id: "about", visible: false }, { id: "work", visible: false }],
    } });
    const markup = renderToStaticMarkup(createElement(HomeExperience, { content, locale: "en", editor: true }));
    expect(markup.indexOf('id="contact"')).toBeLessThan(markup.indexOf('id="identity"'));
    expect(markup).not.toContain('id="work"');
    expect(markup).not.toContain('data-cms-path="en.hero.work"');
    expect(markup).not.toContain('id="about"');
  });
});
