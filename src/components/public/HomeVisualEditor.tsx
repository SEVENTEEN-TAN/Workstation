"use client";

import { useEffect, useState } from "react";

import type { PublicResumeData } from "../../lib/services/public-resume";
import { parseParentContentMessage } from "../admin/home/visual-editor-protocol";
import { HomeExperience } from "./HomeExperience";

export function HomeVisualEditor({ initialData }: { initialData: PublicResumeData }) {
  const [content, setContent] = useState(initialData.content);

  useEffect(() => {
    function receiveContent(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const message = parseParentContentMessage(event.data);
      if (message) setContent(message.content);
    }

    window.addEventListener("message", receiveContent);
    window.parent.postMessage({ type: "homepage-editor:ready" }, window.location.origin);
    return () => window.removeEventListener("message", receiveContent);
  }, []);

  useEffect(() => {
    function commit(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const path = target.dataset.cmsPath;
      if (!path) return;
      window.parent.postMessage({ type: "homepage-editor:commit", path, value: target.textContent ?? "" }, window.location.origin);
    }
    document.addEventListener("focusout", commit);
    return () => document.removeEventListener("focusout", commit);
  }, []);

  return <HomeExperience
    content={content}
    activities={initialData.activities}
    skills={initialData.skills}
    experiences={initialData.experiences}
    resumeDownloads={initialData.downloads}
    editor
  />;
}
