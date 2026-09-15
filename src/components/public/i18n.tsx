"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { SiteContent } from "../../lib/content/schema";

export type Locale = "en" | "zh";

const STORAGE_KEY = "seventeen-locale";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  copy: SiteContent[Locale];
};

const I18nContext = createContext<I18nValue | null>(null);

export function resolveInitialLocale(savedLocale: string | null, browserLocale = ""): Locale {
  if (savedLocale === "zh" || savedLocale === "en") return savedLocale;
  return browserLocale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({ children, content }: { children: React.ReactNode; content: SiteContent }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    // Locale is browser-owned state; hydrate from the persisted preference after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(resolveInitialLocale(window.localStorage.getItem(STORAGE_KEY), window.navigator.language));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    document.title = content[locale].meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", content[locale].meta.description);
  }, [content, locale]);

  const value = useMemo(() => ({ locale, setLocale, copy: content[locale] }), [content, locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used within I18nProvider");
  return value;
}
