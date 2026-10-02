import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));
vi.mock("react", () => ({
  useRef: (value: unknown) => ({ current: value }),
  useState: (value: unknown) => [value, vi.fn()],
  useEffect: (effect: () => (() => void) | void) => {
    const cleanup = effect();
    if (cleanup) harness.cleanups.push(cleanup);
  },
}));
vi.mock("../src/components/public/HomeExperience", () => ({ HomeExperience: () => null }));

import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import { HomeVisualEditor } from "../src/components/public/HomeVisualEditor";
import type { PublicResumeData } from "../src/lib/services/public-resume";

class EditableField {
  dataset = { cmsPath: "zh.hero.lineOne" };
  textContent = bootstrapSiteContent.zh.hero.lineOne;
  closest() { return this; }
}

let field: EditableField;
let previewWindow: EventTarget;
let previewDocument: EventTarget;

function editEvent(type: string) {
  const event = new Event(type);
  Object.defineProperty(event, "target", { value: field });
  previewDocument.dispatchEvent(event);
}

function unload() {
  const event = new Event("beforeunload", { cancelable: true });
  previewWindow.dispatchEvent(event);
  return event.defaultPrevented;
}

function flush() {
  const event = new Event("message");
  Object.assign(event, { origin: "https://sqtan.test", source: window.parent,
    data: { type: "homepage-editor:flush", requestId: 1 } });
  previewWindow.dispatchEvent(event);
}

beforeEach(() => {
  vi.useFakeTimers();
  field = new EditableField();
  previewWindow = new EventTarget();
  previewDocument = new EventTarget();
  Object.assign(previewWindow, { location: { origin: "https://sqtan.test" }, parent: { postMessage: vi.fn() } });
  Object.assign(previewDocument, { activeElement: field, querySelectorAll: () => [] });
  vi.stubGlobal("Element", EditableField);
  vi.stubGlobal("window", previewWindow);
  vi.stubGlobal("document", previewDocument);
  HomeVisualEditor({ initialData: { content: bootstrapSiteContent } as PublicResumeData });
});

afterEach(() => {
  harness.cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("preview native unload protection", () => {
  it("does not warn for a clean preview", () => {
    editEvent("focusin");
    expect(unload()).toBe(false);
  });

  it("protects text still focused and not yet sent to the parent", () => {
    field.textContent = "尚未失焦的新输入";
    editEvent("input");
    expect(unload()).toBe(true);
    expect(window.parent.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "homepage-editor:commit" }), expect.anything(),
    );
  });

  it("protects unfinished and completed composition until the text is flushed", async () => {
    editEvent("compositionstart");
    field.textContent = "组合输入";
    expect(unload()).toBe(true);
    editEvent("compositionend");
    expect(unload()).toBe(true);
    flush();
    expect(unload()).toBe(false);
    await Promise.resolve();
  });

  it("keeps protection when a flush is waiting for composition", async () => {
    editEvent("compositionstart");
    flush();
    expect(unload()).toBe(true);
    editEvent("compositionend");
    await vi.runAllTicks();
    expect(unload()).toBe(false);
  });

  it("does not mark non-text selections as pending text", () => {
    field.dataset.cmsPath = "settings.portraitImage";
    editEvent("input");
    expect(unload()).toBe(false);
  });
});
