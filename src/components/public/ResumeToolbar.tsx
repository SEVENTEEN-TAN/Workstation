"use client";

import { ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";

import type { Locale } from "./i18n";
import { useI18n } from "./i18n";
import styles from "../../app/resume/resume.module.css";

export function ResumeToolbar({ downloads }: { downloads: { zh: boolean; en: boolean } }) {
  const { locale, setLocale } = useI18n();
  const hasDownload = downloads[locale];

  function selectLocale(nextLocale: Locale) {
    window.localStorage.setItem("seventeen-locale", nextLocale);
    setLocale(nextLocale);
  }

  return (
    <div className={styles.resumeToolbar} aria-label={locale === "zh" ? "简历工具栏" : "Resume toolbar"}>
      <Link className={styles.toolbarLink} href="/">
        <ArrowLeft aria-hidden="true" />
        {locale === "zh" ? "返回主页" : "Home"}
      </Link>
      <div className={styles.toolbarActions}>
        <div className={styles.localeControl} role="group" aria-label={locale === "zh" ? "简历语言" : "Resume language"}>
          <button type="button" aria-pressed={locale === "zh"} onClick={() => selectLocale("zh")}>中</button>
          <button type="button" aria-pressed={locale === "en"} onClick={() => selectLocale("en")}>EN</button>
        </div>
        {hasDownload ? (
          <a className={styles.iconButton} href={`/api/resume/${locale}`} title={locale === "zh" ? "下载 PDF" : "Download PDF"} aria-label={locale === "zh" ? "下载 PDF 简历" : "Download PDF resume"}>
            <Download aria-hidden="true" />
          </a>
        ) : null}
        <button className={styles.iconButton} type="button" onClick={() => window.print()} title={locale === "zh" ? "打印" : "Print"} aria-label={locale === "zh" ? "打印简历" : "Print resume"}>
          <Printer aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
