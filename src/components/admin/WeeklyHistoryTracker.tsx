"use client";

import { useEffect } from "react";

export const WEEKLY_HISTORY_LEAVE = "weekly-editor:history-leave";
export const WEEKLY_HISTORY_BLOCKED = "weekly-editor:history-blocked";
export const WEEKLY_HISTORY_READY = "weekly-editor:history-ready";
const positionKey = "__weeklyEditorHistoryPosition";

function nativeHistoryIndex() {
  return (window as Window & { navigation?: { currentEntry?: { index: number } } }).navigation?.currentEntry?.index;
}

// Track application entries without changing Next's route state. Only the
// weekly editor cancels the event; other forms keep normal navigation.
export function WeeklyHistoryTracker() {
  useEffect(() => {
    const history = window.history;
    const pushState = history.pushState;
    const replaceState = history.replaceState;
    const initial = history.state?.[positionKey];
    let scope: string = initial?.scope ?? crypto.randomUUID();
    let position: number = nativeHistoryIndex() ?? initial?.position ?? 0;
    let restoring = false;
    let pending: PopStateEvent | null = null;
    const withPosition = (data: object | null | undefined, index: number) => ({ ...data, [positionKey]: { scope, position: index } });
    replaceState.call(history, withPosition(history.state, position), "");
    const startScope = () => {
      scope = crypto.randomUUID();
      position = 0;
      pending = null;
      replaceState.call(history, withPosition(history.state, position), "");
    };

    history.pushState = function (data, unused, url) {
      if (pending) startScope();
      pushState.call(this, withPosition(data, position + 1), unused, url);
      position += 1;
    };
    history.replaceState = function (data, unused, url) {
      replaceState.call(this, withPosition(data, position), unused, url);
    };
    const notifyBlocked = () => window.dispatchEvent(new Event(WEEKLY_HISTORY_BLOCKED));
    const mayLeave = () => window.dispatchEvent(new Event(WEEKLY_HISTORY_LEAVE, { cancelable: true }));
    const traverse = (event: PopStateEvent) => {
      if (pending) {
        event.stopImmediatePropagation();
        pending = event;
        notifyBlocked();
        return;
      }
      const marker = event.state?.[positionKey];
      const target: number | undefined = marker?.scope === scope ? marker.position : nativeHistoryIndex();
      if (target === undefined) {
        if (!mayLeave()) {
          // Unmarked entries, including fragments, have no reliable distance on
          // browsers without Navigation API. Keep the editor until it is saved
          // or explicitly discarded, instead of guessing and losing its text.
          event.stopImmediatePropagation();
          pending = event;
          notifyBlocked();
          return;
        }
        startScope();
        return;
      }
      if (restoring) {
        event.stopImmediatePropagation();
        if (target === position) restoring = false;
        else history.go(position - target);
        return;
      }
      if (target !== position && !mayLeave()) {
        // Restore the exact entry before Next can unmount the current editor.
        event.stopImmediatePropagation();
        restoring = true;
        history.go(position - target);
        return;
      }
      position = target;
      replaceState.call(history, withPosition(event.state, position), "");
    };
    const resume = () => {
      if (!pending) return;
      const event = pending;
      pending = null;
      window.dispatchEvent(new PopStateEvent("popstate", { state: event.state }));
    };
    window.addEventListener("popstate", traverse, true);
    window.addEventListener(WEEKLY_HISTORY_READY, resume);
    return () => {
      window.removeEventListener("popstate", traverse, true);
      window.removeEventListener(WEEKLY_HISTORY_READY, resume);
      history.pushState = pushState;
      history.replaceState = replaceState;
    };
  }, []);
  return null;
}
