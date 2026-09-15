"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AdminFeedbackKind = "success" | "error";

export interface AdminFeedback {
  kind: AdminFeedbackKind;
  message: string;
  role: "status" | "alert";
}

export function createFeedback(kind: AdminFeedbackKind, message: string): AdminFeedback {
  return {
    kind,
    message,
    role: kind === "error" ? "alert" : "status",
  };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "操作失败，请稍后重试";
}

export function useAdminAction() {
  const activeKeys = useRef(new Set<string>());
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);

  const clearSuccessTimer = useCallback(() => {
    if (successTimer.current !== null) clearTimeout(successTimer.current);
    successTimer.current = null;
  }, []);

  useEffect(() => clearSuccessTimer, [clearSuccessTimer]);

  const dismissFeedback = useCallback(() => {
    clearSuccessTimer();
    setFeedback(null);
  }, [clearSuccessTimer]);

  const isBusy = useCallback((key: string) => busyKeys.has(key), [busyKeys]);

  const runAction = useCallback(async <T,>(
    key: string,
    work: () => Promise<T>,
    successMessage?: string,
  ): Promise<T | undefined> => {
    if (activeKeys.current.has(key)) return undefined;

    activeKeys.current.add(key);
    setBusyKeys(new Set(activeKeys.current));
    clearSuccessTimer();
    setFeedback(null);

    try {
      const result = await work();
      if (successMessage) {
        setFeedback(createFeedback("success", successMessage));
        successTimer.current = setTimeout(() => {
          setFeedback(null);
          successTimer.current = null;
        }, 4_000);
      }
      return result;
    } catch (cause) {
      setFeedback(createFeedback("error", errorMessage(cause)));
      return undefined;
    } finally {
      activeKeys.current.delete(key);
      setBusyKeys(new Set(activeKeys.current));
    }
  }, [clearSuccessTimer]);

  return { feedback, dismissFeedback, isBusy, runAction };
}
