"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

import type { PublicResumeData } from "../../lib/services/public-resume";
import { useI18n, type Locale } from "./i18n";
import { reveal } from "./motion";

const labels = {
  en: {
    eyebrow: "02 — NOW",
    heading: "WORK IN MOTION.",
    intro: "Recent releases, progress and milestones from the work I am doing now.",
    viewAll: "View all activity",
    empty: "New professional updates will appear here after they are ready to share.",
  },
  zh: {
    eyebrow: "02 — 最新动态",
    heading: "正在发生的工作。",
    intro: "展示近期发布、重要进展与职业里程碑，让最新状态不止停留在简历里。",
    viewAll: "查看全部动态",
    empty: "新的职业进展整理完成并设为公开后，会出现在这里。",
  },
} as const;

function localized(locale: Locale, zh: string, en: string | null) {
  return locale === "zh" || !en ? zh : en;
}

function formatDate(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function HomeNow({ activities }: { activities: PublicResumeData["activities"] }) {
  const { locale } = useI18n();
  const copy = labels[locale];
  const recent = activities.slice(0, 3);

  return (
    <section id="now" className="scroll-mt-20 border-b border-white/[0.06] py-24 sm:py-32">
      <div className="page-shell">
        <motion.div {...reveal} transition={{ duration: 0.7 }} className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 className="section-heading mt-7">{copy.heading}</h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">{copy.intro}</p>
          </div>
          <Link href="/activities" className="text-link focus-ring group self-start sm:self-auto">
            {copy.viewAll}<ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

        {recent.length ? (
          <div className="mt-14 border-t border-white/10">
            {recent.map((activity, index) => (
              <motion.article key={activity.id} {...reveal} transition={{ duration: 0.55, delay: index * 0.08 }} className="grid gap-4 border-b border-white/10 py-7 sm:grid-cols-[9rem_1fr_auto] sm:items-start sm:gap-8 sm:py-9">
                <time className="text-xs font-bold uppercase tracking-[0.16em] text-gray-600">{formatDate(locale, activity.occurredAt)}</time>
                <div>
                  <h3 className="font-display text-2xl font-black tracking-tight text-white sm:text-3xl">{localized(locale, activity.titleZh, activity.titleEn)}</h3>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-400 sm:text-base">{localized(locale, activity.summaryZh, activity.summaryEn)}</p>
                </div>
                {activity.linkUrl ? <a href={activity.linkUrl} className="focus-ring inline-flex size-10 items-center justify-center border border-white/15 text-accent transition-colors hover:border-accent hover:text-white" aria-label={localized(locale, activity.titleZh, activity.titleEn)}><ArrowUpRight className="size-4" /></a> : null}
              </motion.article>
            ))}
          </div>
        ) : <p className="mt-12 max-w-2xl border-l-2 border-accent pl-6 text-base leading-relaxed text-gray-400">{copy.empty}</p>}
      </div>
    </section>
  );
}
