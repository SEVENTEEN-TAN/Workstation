import type { SiteContent } from "../../../lib/content/schema";
import { isSiteContentDirty, reconcileFetchedHomeContent } from "./content-editor";

export interface EditHistory {
  past: SiteContent[];
  present: SiteContent;
  future: SiteContent[];
}

export function createEditHistory(content: SiteContent): EditHistory {
  return { past: [], present: content, future: [] };
}

export function recordEdit(history: EditHistory, next: SiteContent): EditHistory {
  if (!isSiteContentDirty(next, history.present)) return history;
  return { past: [...history.past, history.present].slice(-100), present: next, future: [] };
}

export function undoEdit(history: EditHistory): EditHistory {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
  };
}

export function redoEdit(history: EditHistory): EditHistory {
  if (!history.future.length) return history;
  return {
    past: [...history.past, history.present].slice(-100),
    present: history.future[0],
    future: history.future.slice(1),
  };
}

export function synchronizeEditHistory(history: EditHistory, contentAtRequest: SiteContent, fetched: SiteContent, reset = false): EditHistory {
  const present = reconcileFetchedHomeContent(history.present, contentAtRequest, fetched);
  return reset ? createEditHistory(present) : { ...history, present };
}
