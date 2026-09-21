import { describe, expect, it } from "vitest";

import { isVisualEditField, parseIframeMessage } from "../src/components/admin/home/visual-editor-protocol";

describe("homepage visual-editor protocol", () => {
  it("accepts only registered homepage content paths", () => {
    expect(isVisualEditField("en.hero.intro")).toBe(true);
    expect(isVisualEditField("settings.githubUrl")).toBe(true);
    expect(isVisualEditField("__proto__.polluted")).toBe(false);
    expect(isVisualEditField("zh.projects.0.title")).toBe(false);
  });

  it("rejects malformed commits and HTML payloads", () => {
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "settings.portraitImage", value: "<img>" })).toBeNull();
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "unknown.path", value: "Text" })).toBeNull();
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "en.hero.intro", value: "Updated intro" })).toEqual({
      type: "homepage-editor:commit",
      path: "en.hero.intro",
      value: "Updated intro",
    });
  });
});
