import { describe, expect, it, vi } from "vitest";

import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import {
  getVisualEditField,
  isTrustedEditorMessage,
  isVisualEditField,
  parseIframeMessage,
  parseParentMessage,
  sendEditorPreviewState,
} from "../src/components/admin/home/visual-editor-protocol";
import {
  createTextCommit,
  editableTextProps,
  safeEditorLinkTarget,
  selectableFieldProps,
} from "../src/components/public/visual-editing";

describe("homepage visual-editor protocol", () => {
  it("builds editor-only attributes and safe text commits", () => {
    expect(editableTextProps(false, "en.hero.lineOne")).toEqual({});
    expect(selectableFieldProps(false, "settings.portraitImage")).toEqual({});
    expect(editableTextProps(true, "en.hero.lineOne")).toEqual({
      "data-cms-path": "en.hero.lineOne",
      contentEditable: true,
      suppressContentEditableWarning: true,
      tabIndex: 0,
    });
    expect(selectableFieldProps(true, "settings.portraitImage")).toEqual({
      "data-cms-path": "settings.portraitImage",
      role: "button",
      tabIndex: 0,
    });
    expect(createTextCommit(bootstrapSiteContent, "en.hero.lineOne", "中文输入", true)).toBeNull();
    expect(createTextCommit(bootstrapSiteContent, "en.hero.lineOne", "中文输入", false)).toEqual({
      type: "homepage-editor:commit",
      path: "en.hero.lineOne",
      value: "中文输入",
    });
    expect(safeEditorLinkTarget("github", "javascript:alert(1)")).toBeUndefined();
    expect(safeEditorLinkTarget("github", "https://github.com/SEVENTEEN-TAN")).toBe("https://github.com/SEVENTEEN-TAN");
  });

  it("accepts only registered homepage content paths", () => {
    expect(isVisualEditField("en.hero.intro")).toBe(true);
    expect(isVisualEditField("settings.githubUrl")).toBe(true);
    expect(isVisualEditField("__proto__.polluted")).toBe(false);
    expect(isVisualEditField("zh.projects.0.title")).toBe(false);
  });

  it("accepts text commits only for fields registered in the current content", () => {
    const content = structuredClone(bootstrapSiteContent);

    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "en.hero.intro", value: 42 }, content)).toBeNull();
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "settings.portraitImage", value: "/images/next.png" }, content)).toBeNull();
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "settings.githubUrl", value: "https://github.com/example" }, content)).toBeNull();
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "unknown.path", value: "Text" }, content)).toBeNull();
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "en.hero.intro", value: "Java < AI" }, content)).toEqual({
      type: "homepage-editor:commit",
      path: "en.hero.intro",
      value: "Java < AI",
    });
    expect(parseIframeMessage({ type: "homepage-editor:commit", path: "en.hero.intro", value: "x".repeat(10_001) }, content)).toBeNull();
  });

  it("parses every trusted parent and iframe message variant", () => {
    const temporary = structuredClone(bootstrapSiteContent);
    temporary.en.hero.lineOne = "";
    const dynamicPath = `en.about.paragraphs.${temporary.en.about.paragraphs.length - 1}`;

    expect(parseParentMessage({
      type: "homepage-editor:content",
      content: temporary,
      locale: "en",
      selectedPath: "en.hero.lineOne",
    })).toMatchObject({ type: "homepage-editor:content", locale: "en", selectedPath: "en.hero.lineOne" });
    expect(parseParentMessage({
      type: "homepage-editor:content",
      content: temporary,
      locale: "en",
      selectedPath: "en.about.paragraphs.999",
    })).toMatchObject({ type: "homepage-editor:content", selectedPath: null });
    for (const section of ["identity", "about", "now", "work", "capability", "journey", "contact"]) {
      expect(parseParentMessage({ type: "homepage-editor:focus", section })).toEqual({ type: "homepage-editor:focus", section });
    }
    expect(parseParentMessage({ type: "homepage-editor:focus", section: "unknown" })).toBeNull();
    expect(parseParentMessage({
      type: "homepage-editor:content",
      content: temporary,
      locale: "en",
      selectedPath: 1,
    })).toBeNull();
    expect(parseIframeMessage({ type: "homepage-editor:ready" }, temporary)).toEqual({ type: "homepage-editor:ready" });
    expect(parseIframeMessage({ type: "homepage-editor:select", path: dynamicPath }, temporary)).toEqual({ type: "homepage-editor:select", path: dynamicPath });
    expect(parseIframeMessage({ type: "homepage-editor:locale", locale: "zh" }, temporary)).toEqual({ type: "homepage-editor:locale", locale: "zh" });
    expect(parseIframeMessage({ type: "homepage-editor:locale", locale: "fr" }, temporary)).toBeNull();
  });

  it("requires both the expected origin and iframe source, and replays the complete preview state", () => {
    const expectedSource = {} as MessageEventSource;
    const foreignSource = {} as MessageEventSource;
    const postMessage = vi.fn();

    expect(isTrustedEditorMessage({ origin: "https://sqtan.test", source: expectedSource }, "https://sqtan.test", expectedSource)).toBe(true);
    expect(isTrustedEditorMessage({ origin: "https://sqtan.test", source: foreignSource }, "https://sqtan.test", expectedSource)).toBe(false);
    expect(isTrustedEditorMessage({ origin: "https://sqtan.test", source: null }, "https://sqtan.test", null)).toBe(false);
    expect(isTrustedEditorMessage({ origin: "https://other.test", source: expectedSource }, "https://sqtan.test", expectedSource)).toBe(false);

    sendEditorPreviewState({ postMessage }, "https://sqtan.test", {
      content: bootstrapSiteContent,
      locale: "zh",
      selectedPath: "zh.hero.lineOne",
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: "homepage-editor:content",
      content: bootstrapSiteContent,
      locale: "zh",
      selectedPath: "zh.hero.lineOne",
    }, "https://sqtan.test");
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
