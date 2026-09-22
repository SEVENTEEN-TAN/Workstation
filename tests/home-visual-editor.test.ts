import { describe, expect, it } from "vitest";

import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import {
  getVisualEditField,
  isVisualEditField,
  parseIframeMessage,
} from "../src/components/admin/home/visual-editor-protocol";

describe("homepage visual-editor protocol", () => {
  it("accepts only registered homepage content paths", () => {
    expect(isVisualEditField("en.hero.intro")).toBe(true);
    expect(isVisualEditField("settings.githubUrl")).toBe(true);
    expect(isVisualEditField("__proto__.polluted")).toBe(false);
    expect(isVisualEditField("zh.projects.0.title")).toBe(false);
  });

  it("rejects malformed commits and HTML payloads", () => {
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "en.hero.intro", value: 42 })).toBeNull();
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "settings.portraitImage", value: "<img>" })).toBeNull();
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "unknown.path", value: "Text" })).toBeNull();
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "en.hero.intro", value: "Updated intro" })).toEqual({
      type: "homepage-editor:commit",
      path: "en.hero.intro",
      value: "Updated intro",
    });
  });

  it("finds only concrete editable content paths", () => {
    const editing = structuredClone(bootstrapSiteContent);
    const paragraphPath = `en.about.paragraphs.${editing.en.about.paragraphs.length - 1}`;

    expect(getVisualEditField(editing, paragraphPath)?.kind).toBe("text");
    expect(getVisualEditField(editing, "en.services.items.0.1")?.section).toBe("capability");
    expect(getVisualEditField(editing, "settings.portraitImage")).toMatchObject({
      kind: "image",
      altPaths: { zh: "zh.hero.portraitAlt", en: "en.hero.portraitAlt" },
    });
    expect(getVisualEditField(editing, "activities.0.titleEn")).toBeNull();
    expect(getVisualEditField(editing, "__proto__.polluted")).toBeNull();
  });
});
