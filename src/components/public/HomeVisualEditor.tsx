"use client";

import { useEffect, useRef, useState } from "react";

import type { SiteLocale } from "../admin/home/content-editor";
import type { PublicResumeData } from "../../lib/services/public-resume";
import { getVisualEditField, isTrustedEditorMessage, parseParentMessage } from "../admin/home/visual-editor-protocol";
import { HomeExperience } from "./HomeExperience";
import { createTextCommit } from "./visual-editing";

export function HomeVisualEditor({ initialData }: { initialData: PublicResumeData }) {
  const [content, setContent] = useState(initialData.content);
  const [locale, setLocale] = useState<SiteLocale>("en");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const contentRef = useRef(content);
  const composing = useRef(false);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    function receiveParentMessage(event: MessageEvent) {
      if (!isTrustedEditorMessage(event, window.location.origin, window.parent)) return;
      const message = parseParentMessage(event.data);
      if (!message) return;
      if (message.type === "homepage-editor:content") {
        setContent(message.content);
        setLocale(message.locale);
        setSelectedPath(message.selectedPath);
      }
      if (message.type === "homepage-editor:focus") {
        document.getElementById(message.section)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    window.addEventListener("message", receiveParentMessage);
    window.parent.postMessage({ type: "homepage-editor:ready" }, window.location.origin);
    return () => window.removeEventListener("message", receiveParentMessage);
  }, []);

  useEffect(() => {
    function fieldTarget(target: EventTarget | null) {
      if (!(target instanceof Element)) return null;
      const element = target.closest<HTMLElement>("[data-cms-path]");
      return element && getVisualEditField(contentRef.current, element.dataset.cmsPath) ? element : null;
    }

    function select(event: Event) {
      const target = fieldTarget(event.target);
      if (target) window.parent.postMessage({ type: "homepage-editor:select", path: target.dataset.cmsPath }, window.location.origin);
    }

    function commitTarget(target: HTMLElement) {
      const message = createTextCommit(contentRef.current, target.dataset.cmsPath, target.textContent ?? "", composing.current);
      if (message) window.parent.postMessage(message, window.location.origin);
    }

    function insertPlainText(text: string) {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return;
      selection.deleteFromDocument();
      const range = selection.getRangeAt(0);
      const node = document.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    function onClick(event: MouseEvent) {
      select(event);
      if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
    }

    function onFocusOut(event: FocusEvent) {
      const target = fieldTarget(event.target);
      if (target) queueMicrotask(() => commitTarget(target));
    }

    function onPaste(event: ClipboardEvent) {
      const target = fieldTarget(event.target);
      if (!target || getVisualEditField(contentRef.current, target.dataset.cmsPath)?.kind !== "text") return;
      event.preventDefault();
      insertPlainText(event.clipboardData?.getData("text/plain") ?? "");
    }

    function onComposition(event: CompositionEvent) {
      const target = fieldTarget(event.target);
      if (target && getVisualEditField(contentRef.current, target.dataset.cmsPath)?.kind === "text") composing.current = event.type === "compositionstart";
    }

    function preventSubmit(event: SubmitEvent) {
      event.preventDefault();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", preventSubmit, true);
    document.addEventListener("focusin", select);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("compositionstart", onComposition);
    document.addEventListener("compositionend", onComposition);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", preventSubmit, true);
      document.removeEventListener("focusin", select);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("compositionstart", onComposition);
      document.removeEventListener("compositionend", onComposition);
    };
  }, []);

  useEffect(() => {
    const selected = Array.from(document.querySelectorAll<HTMLElement>("[data-cms-path]"))
      .find((element) => element.dataset.cmsPath === selectedPath);
    selected?.setAttribute("data-cms-selected", "true");
    return () => selected?.removeAttribute("data-cms-selected");
  }, [selectedPath]);

  function changeLocale(nextLocale: SiteLocale) {
    setLocale(nextLocale);
    window.parent.postMessage({ type: "homepage-editor:locale", locale: nextLocale }, window.location.origin);
  }

  return <HomeExperience
    content={content}
    activities={initialData.activities}
    skills={initialData.skills}
    experiences={initialData.experiences}
    resumeDownloads={initialData.downloads}
    editor
    locale={locale}
    onLocaleChange={changeLocale}
  />;
}
