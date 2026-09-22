"use client";

import { useEffect, useState } from "react";

import type { SiteLocale } from "../admin/home/content-editor";
import type { PublicResumeData } from "../../lib/services/public-resume";
import { isTrustedEditorMessage, parseParentMessage } from "../admin/home/visual-editor-protocol";
import { HomeExperience } from "./HomeExperience";

export function HomeVisualEditor({ initialData }: { initialData: PublicResumeData }) {
  const [content, setContent] = useState(initialData.content);
  const [locale, setLocale] = useState<SiteLocale>("en");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

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
    function select(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const path = target.dataset.cmsPath;
      if (path) window.parent.postMessage({ type: "homepage-editor:select", path }, window.location.origin);
    }

    function commit(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const path = target.dataset.cmsPath;
      if (!path) return;
      window.parent.postMessage({ type: "homepage-editor:commit", path, value: target.textContent ?? "" }, window.location.origin);
    }
    document.addEventListener("focusin", select);
    document.addEventListener("focusout", commit);
    return () => {
      document.removeEventListener("focusin", select);
      document.removeEventListener("focusout", commit);
    };
  }, []);

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
