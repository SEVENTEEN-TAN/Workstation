"use client";

import { ArrowLeft, ArrowUpRight, Languages, Star } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

import type { SiteContent } from "../../lib/content/schema";
import { I18nProvider, useI18n, type Locale } from "./i18n";
import { reveal } from "./motion";

export type PublicCareerActivity = {
  id: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  occurredAt: string;
  featured: boolean;
  linkUrl: string | null;
};

const labels = {
  en: { back: "Back home", eyebrow: "PERSONAL WORKSTATION / ACTIVITY", title: "WORK IN MOTION.", intro: "Recent releases, meaningful progress and the milestones shaping my professional path.", featured: "Featured", empty: "No public activity yet.", emptyDetail: "New professional updates will appear here after they are ready to share.", open: "Open related link" },
  zh: { back: "返回主页", eyebrow: "个人工作站 / 最新动态", title: "持续行动，持续积累。", intro: "记录近期发布、重要进展与职业里程碑，让正在发生的工作成为可验证的成长轨迹。", featured: "精选", empty: "暂时没有公开动态。", emptyDetail: "新的职业进展整理完成并设为公开后，会出现在这里。", open: "打开相关链接" },
} as const;

function localized(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

function formatDate(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

function ActivityContent({ activities }: { activities: PublicCareerActivity[] }) {
  const { locale, setLocale } = useI18n();
  const copy = labels[locale];
  return (
    <div className="min-h-screen bg-ink text-white selection:bg-accent selection:text-ink">
      <header className="border-b border-white/[0.08] bg-[#0f1115]/90 backdrop-blur-xl"><nav className="page-shell flex h-20 items-center justify-between"><Link href="/" className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-gray-300 transition-colors hover:text-accent"><ArrowLeft className="size-4" />{copy.back}</Link><button type="button" onClick={() => setLocale(locale === "en" ? "zh" : "en")} className="focus-ring flex size-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:border-accent hover:text-accent" aria-label={locale === "en" ? "切换为中文" : "Switch to English"}><Languages className="size-4" /></button></nav></header>
      <main>
        <section className="hero-grid border-b border-white/[0.06] py-20 sm:py-28"><div className="page-shell"><motion.div {...reveal} transition={{ duration: 0.65 }}><p className="eyebrow">{copy.eyebrow}</p><h1 className="mt-7 max-w-5xl font-display text-4xl font-black leading-[0.92] text-white sm:text-6xl lg:text-8xl">{copy.title}</h1><p className="mt-7 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">{copy.intro}</p></motion.div></div></section>
        {activities.length ? <section className="page-shell py-20 sm:py-28"><div className="relative ml-2 border-l border-white/10 sm:ml-36">{activities.map((activity, index) => <motion.article key={activity.id} {...reveal} transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.3) }} className="relative mb-6 pl-7 last:mb-0 sm:pl-12"><span className="absolute -left-1.5 top-8 size-3 border border-accent bg-ink" /><time className="mb-3 block text-xs font-bold uppercase text-gray-600 sm:absolute sm:right-full sm:top-7 sm:mr-10 sm:w-28 sm:text-right">{formatDate(locale, activity.occurredAt)}</time><div className="border border-white/10 bg-white/[0.025] p-5 sm:p-7"><div className="flex flex-wrap items-center gap-3">{activity.featured ? <span className="inline-flex items-center gap-1.5 border border-accent/30 px-2 py-1 text-[10px] font-bold uppercase text-accent"><Star className="size-3" />{copy.featured}</span> : null}</div><h2 className="mt-4 font-display text-2xl font-black text-white sm:text-3xl">{localized(locale, activity.titleZh, activity.titleEn)}</h2><p className="mt-4 max-w-3xl text-sm leading-7 text-gray-400 sm:text-base">{localized(locale, activity.summaryZh, activity.summaryEn)}</p>{activity.linkUrl ? <a href={activity.linkUrl} target="_blank" rel="noreferrer" className="focus-ring mt-6 inline-flex items-center gap-2 text-sm font-bold text-accent hover:text-white">{copy.open}<ArrowUpRight className="size-4" /></a> : null}</div></motion.article>)}</div></section> : <section className="page-shell py-24 sm:py-32"><div className="max-w-2xl border-l-2 border-accent pl-6 sm:pl-9"><p className="font-display text-3xl font-black text-white sm:text-5xl">{copy.empty}</p><p className="mt-5 text-base leading-relaxed text-gray-400 sm:text-lg">{copy.emptyDetail}</p></div></section>}
      </main>
    </div>
  );
}

export function ActivityExperience({ content, activities }: { content: SiteContent; activities: PublicCareerActivity[] }) {
  return <I18nProvider content={content}><ActivityContent activities={activities} /></I18nProvider>;
}
