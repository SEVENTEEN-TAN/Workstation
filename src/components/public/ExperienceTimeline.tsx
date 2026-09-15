"use client";

import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, GraduationCap, Languages } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

import type { SiteContent } from "../../lib/content/schema";
import { I18nProvider, useI18n, type Locale } from "./i18n";
import { reveal } from "./motion";

export type PublicExperienceRecord = {
  id: string;
  kind: "WORK" | "EDUCATION";
  organizationZh: string;
  organizationEn: string;
  titleZh: string;
  titleEn: string;
  descriptionZh: string;
  descriptionEn: string;
  locationZh: string | null;
  locationEn: string | null;
  linkUrl: string | null;
  startedAt: string;
  endedAt: string | null;
  isCurrent: boolean;
  featured: boolean;
  sortOrder: number;
};

const labels = {
  en: {
    back: "Back home",
    eyebrow: "PERSONAL WORKSTATION / JOURNEY",
    title: "A TRACEABLE PATH.",
    intro: "Work and education experience that explains where I built my engineering judgment.",
    work: "Work",
    education: "Education",
    present: "Present",
    location: "Location",
    open: "Open related link",
    empty: "No public experience yet.",
    emptyDetail: "Bilingual work and education records will appear here after they are ready to share.",
  },
  zh: {
    back: "返回主页",
    eyebrow: "个人工作站 / 职业路径",
    title: "让职业路径可追溯。",
    intro: "以时间线整理工作与教育经历，说明工程判断与专业能力是在哪里持续建立的。",
    work: "工作",
    education: "教育",
    present: "至今",
    location: "地点",
    open: "打开相关链接",
    empty: "暂时没有公开经历。",
    emptyDetail: "双语完整的工作与教育经历整理完成并设为公开后，会出现在这里。",
  },
} as const;

function localized(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

function formatDate(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function ExperienceContent({ experiences }: { experiences: readonly PublicExperienceRecord[] }) {
  const { locale, setLocale } = useI18n();
  const copy = labels[locale];

  return (
    <div className="min-h-screen bg-ink text-white selection:bg-accent selection:text-ink">
      <header className="border-b border-white/[0.08] bg-[#0f1115]/90 backdrop-blur-xl">
        <nav className="page-shell flex h-20 items-center justify-between">
          <Link href="/" className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-gray-300 transition-colors hover:text-accent"><ArrowLeft className="size-4" />{copy.back}</Link>
          <button type="button" onClick={() => setLocale(locale === "en" ? "zh" : "en")} className="focus-ring flex size-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:border-accent hover:text-accent" aria-label={locale === "en" ? "切换为中文" : "Switch to English"}><Languages className="size-4" /></button>
        </nav>
      </header>
      <main>
        <section className="hero-grid border-b border-white/[0.06] py-20 sm:py-28">
          <div className="page-shell">
            <motion.div {...reveal} transition={{ duration: 0.65 }}>
              <p className="eyebrow">{copy.eyebrow}</p>
              <h1 className="mt-7 max-w-5xl font-display text-4xl font-black leading-[0.92] text-white sm:text-6xl lg:text-8xl">{copy.title}</h1>
              <p className="mt-7 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">{copy.intro}</p>
            </motion.div>
          </div>
        </section>
        {experiences.length ? (
          <section className="page-shell py-20 sm:py-28">
            <div className="relative ml-2 border-l border-white/10 sm:ml-36">
              {experiences.map((experience, index) => (
                <motion.article key={experience.id} {...reveal} transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.3) }} className="relative mb-6 pl-7 last:mb-0 sm:pl-12">
                  <span className="absolute -left-1.5 top-8 size-3 border border-accent bg-ink" />
                  <time className="mb-3 block text-xs font-bold uppercase text-gray-600 sm:absolute sm:right-full sm:top-7 sm:mr-10 sm:w-28 sm:text-right">
                    {formatDate(locale, experience.startedAt)} - {experience.isCurrent ? copy.present : experience.endedAt ? formatDate(locale, experience.endedAt) : "—"}
                  </time>
                  <div className="border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 border border-accent/30 px-2 py-1 text-[10px] font-bold uppercase text-accent">
                        {experience.kind === "WORK" ? <BriefcaseBusiness className="size-3" /> : <GraduationCap className="size-3" />}
                        {experience.kind === "WORK" ? copy.work : copy.education}
                      </span>
                      {(locale === "zh" ? experience.locationZh : experience.locationEn) ? (
                        <span className="border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-gray-500">
                          {copy.location}: {locale === "zh" ? experience.locationZh : experience.locationEn}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-4 font-display text-2xl font-black text-white sm:text-3xl">{localized(locale, experience.organizationZh, experience.organizationEn)}</h2>
                    <p className="mt-3 text-sm font-bold uppercase tracking-[0.16em] text-accent">{localized(locale, experience.titleZh, experience.titleEn)}</p>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-400 sm:text-base">{localized(locale, experience.descriptionZh, experience.descriptionEn)}</p>
                    {experience.linkUrl ? <a href={experience.linkUrl} target="_blank" rel="noreferrer" className="focus-ring mt-6 inline-flex items-center gap-2 text-sm font-bold text-accent hover:text-white">{copy.open}<ArrowUpRight className="size-4" /></a> : null}
                  </div>
                </motion.article>
              ))}
            </div>
          </section>
        ) : (
          <section className="page-shell py-24 sm:py-32">
            <div className="max-w-2xl border-l-2 border-accent pl-6 sm:pl-9">
              <p className="font-display text-3xl font-black text-white sm:text-5xl">{copy.empty}</p>
              <p className="mt-5 text-base leading-relaxed text-gray-400 sm:text-lg">{copy.emptyDetail}</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export function ExperienceTimeline({
  content,
  experiences,
  initialLocale = "zh",
}: {
  content: SiteContent;
  experiences: readonly PublicExperienceRecord[];
  initialLocale?: Locale;
}) {
  return <I18nProvider content={content} initialLocale={initialLocale}><ExperienceContent experiences={experiences} /></I18nProvider>;
}
