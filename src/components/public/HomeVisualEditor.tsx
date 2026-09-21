"use client";

import { useEffect, useState } from "react";

import type { SiteContent } from "../../lib/content/schema";
import { parseParentContentMessage } from "../admin/home/visual-editor-protocol";
import { HomeExperience } from "./HomeExperience";

export function HomeVisualEditor({ initialContent }: { initialContent: SiteContent }) {
  const [content, setContent] = useState(initialContent);

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

  return <HomeExperience content={content} editor />;
}
