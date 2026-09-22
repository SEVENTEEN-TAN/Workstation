"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { SiteContent } from "../../lib/content/schema";

export type Locale = "en" | "zh";

const STORAGE_KEY = "seventeen-locale";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  copy: SiteContent[Locale];
  settings: SiteContent["settings"];
  editor: boolean;
};

const I18nContext = createContext<I18nValue | null>(null);

export function resolveInitialLocale(savedLocale: string | null, browserLocale = ""): Locale {
  if (savedLocale === "zh" || savedLocale === "en") return savedLocale;
  return browserLocale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({
  children,
  content,
  initialLocale = "en",
  editor = false,
  locale: controlledLocale,
  onLocaleChange,
}: {
  children: React.ReactNode;
  content: SiteContent;
  initialLocale?: Locale;
  editor?: boolean;
  locale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const activeLocale = controlledLocale ?? locale;

  const changeLocale = useCallback((next: Locale) => {
    if (controlledLocale === undefined) setLocale(next);
    onLocaleChange?.(next);
  }, [controlledLocale, onLocaleChange]);

  useEffect(() => {
    // Locale is browser-owned state; hydrate from the persisted preference after mount.
    if (controlledLocale === undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocale(resolveInitialLocale(window.localStorage.getItem(STORAGE_KEY), window.navigator.language));
    }
  }, [controlledLocale]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, activeLocale);
    document.documentElement.lang = activeLocale === "zh" ? "zh-CN" : "en";
    document.title = content[activeLocale].meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", content[activeLocale].meta.description);
  }, [activeLocale, content]);

  const value = useMemo(() => ({ locale: activeLocale, setLocale: changeLocale, copy: content[activeLocale], settings: content.settings, editor }), [activeLocale, changeLocale, content, editor]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider");
  return value;
}
