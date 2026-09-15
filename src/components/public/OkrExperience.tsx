"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle2, CircleGauge, Languages, Target } from "lucide-react";
import { motion } from "framer-motion";

import type { SiteContent } from "../../lib/content/schema";
import type { Locale } from "./i18n";
import { I18nProvider, useI18n } from "./i18n";
import { reveal } from "./motion";
import type { PublicOkrKeyResult, PublicOkrObjective, PublicOkrReviewRecord, PublicOkrView } from "./data";

const labels = {
  en: {
    back: "Back home",
    eyebrow: "PERSONAL WORKSTATION / OKR",
    title: "GOALS, MADE VISIBLE.",
    intro: "A public view of the objectives I am pursuing, the outcomes that define progress, and the lessons collected along the way.",
    cycles: "Cycles",
    objectives: "Objectives",
    completed: "Completed",
    progress: "Average progress",
    noData: "No public objectives yet.",
    noDataDetail: "Private planning stays private. Public cycles will appear here after they are published.",
    reviews: "Reviews & learnings",
    achievements: "Achievements",
    problems: "Friction",
    lessons: "Lessons",
    next: "Next actions",
    keyResults: "Key results",
    reviewScore: "Review score",
    status: { DRAFT: "Draft", ACTIVE: "Active", IN_PROGRESS: "In progress", COMPLETED: "Completed", NOT_STARTED: "Not started", AT_RISK: "At risk", CLOSED: "Closed" },
  },
  zh: {
    back: "返回主页",
    eyebrow: "个人工作站 / OKR",
    title: "让目标清晰可见。",
    intro: "公开展示我正在推进的目标、衡量进展的关键结果，以及在每个周期中沉淀下来的复盘与经验。",
    cycles: "公开周期",
    objectives: "目标",
    completed: "已完成",
    progress: "平均进度",
    noData: "暂时没有公开目标。",
    noDataDetail: "私密规划会始终保持私密；周期发布后，公开内容会出现在这里。",
    reviews: "复盘与经验",
    achievements: "成果",
    problems: "问题",
    lessons: "经验",
    next: "下一步",
    keyResults: "关键结果",
    reviewScore: "复盘评分",
    status: { DRAFT: "草稿", ACTIVE: "进行中", IN_PROGRESS: "进行中", COMPLETED: "已完成", NOT_STARTED: "未开始", AT_RISK: "有风险", CLOSED: "已结束" },
  },
} as const;

function localized(locale: Locale, zh: string, en?: string | null) {
  return locale === "zh" ? zh : en || zh;
}

function statusLabel(locale: Locale, status: string) {
  const copy = labels[locale].status as Record<string, string>;
  return copy[status] ?? status.replaceAll("_", " ").toLowerCase();
}

function formatDate(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function KeyResultRow({ item, locale }: { item: PublicOkrKeyResult; locale: Locale }) {
  const metric = item.mode === "METRIC" && item.targetValue != null
    ? `${item.currentValue ?? item.startValue ?? 0} / ${item.targetValue}${item.unit ? ` ${item.unit}` : ""}`
    : statusLabel(locale, item.status);

  return (
    <li className="grid gap-3 border-t border-white/[0.08] py-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div><p className="text-sm font-semibold text-gray-200 sm:text-base">{localized(locale, item.titleZh, item.titleEn)}</p>{(item.descriptionZh || item.descriptionEn) && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">{localized(locale, item.descriptionZh ?? "", item.descriptionEn)}</p>}</div>
      <div className="flex min-w-36 items-center gap-4 sm:justify-end"><span className="text-xs text-gray-500">{metric}</span><span className="font-display text-xl font-black text-white">{Math.round(item.progress)}<span className="text-accent">%</span></span></div>
      <div className="h-1.5 overflow-hidden bg-white/[0.08] sm:col-span-2" aria-label={`${Math.round(item.progress)}%`}><div className="h-full bg-accent transition-[width] duration-700" style={{ width: `${item.progress}%` }} /></div>
    </li>
  );
}

function ObjectiveBlock({ objective, locale }: { objective: PublicOkrObjective; locale: Locale }) {
  const copy = labels[locale];
  return (
    <article className="border border-white/10 bg-white/[0.025] p-5 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl"><div className="mb-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-accent"><span>Objective</span><span className="h-px w-8 bg-accent/50" /><span className="text-gray-500">{statusLabel(locale, objective.status)}</span></div><h3 className="font-display text-2xl font-black text-white sm:text-3xl">{localized(locale, objective.titleZh, objective.titleEn)}</h3>{(objective.descriptionZh || objective.descriptionEn) && <p className="mt-4 text-sm leading-relaxed text-gray-400 sm:text-base">{localized(locale, objective.descriptionZh ?? "", objective.descriptionEn)}</p>}</div>
        <div className="shrink-0"><p className="font-display text-4xl font-black text-white sm:text-5xl">{Math.round(objective.progress)}<span className="text-accent">%</span></p><p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-600">{copy.progress}</p></div>
      </div>
      <div className="mt-8"><p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">{copy.keyResults}</p><ul>{objective.keyResults.map((item) => <KeyResultRow key={item.id} item={item} locale={locale} />)}</ul></div>
    </article>
  );
}

function ReviewBlock({ review, locale }: { review: PublicOkrReviewRecord; locale: Locale }) {
  const copy = labels[locale];
  const fields = [
    [copy.achievements, localized(locale, review.achievementsZh, review.achievementsEn)],
    [copy.problems, localized(locale, review.problemsZh, review.problemsEn)],
    [copy.lessons, localized(locale, review.lessonsZh, review.lessonsEn)],
    [copy.next, localized(locale, review.nextActionsZh, review.nextActionsEn)],
  ];
  return (
    <article className="border-l-2 border-accent bg-white/[0.025] p-5 sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-4"><time className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">{formatDate(locale, review.reviewedAt)}</time>{review.score != null && <span className="text-sm font-bold text-accent">{copy.reviewScore} {review.score}/10</span>}</div>
      <dl className="grid gap-6 md:grid-cols-2">{fields.map(([term, detail]) => <div key={term}><dt className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-600">{term}</dt><dd className="mt-2 text-sm leading-relaxed text-gray-300">{detail}</dd></div>)}</dl>
    </article>
  );
}

function OkrContent({ view }: { view: PublicOkrView }) {
  const { locale, setLocale } = useI18n();
  const copy = labels[locale];
  const stats = [
    { label: copy.cycles, value: view.summary.cycleCount, icon: CalendarDays },
    { label: copy.objectives, value: view.summary.objectiveCount, icon: Target },
    { label: copy.completed, value: view.summary.completedObjectives, icon: CheckCircle2 },
    { label: copy.progress, value: `${Math.round(view.summary.averageProgress)}%`, icon: CircleGauge },
  ];

  return (
    <div className="min-h-screen bg-ink text-white selection:bg-accent selection:text-ink">
      <header className="border-b border-white/[0.08] bg-[#0f1115]/90 backdrop-blur-xl"><nav className="page-shell flex h-20 items-center justify-between"><Link href="/" className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-gray-300 transition-colors hover:text-accent"><ArrowLeft className="size-4" />{copy.back}</Link><button type="button" onClick={() => setLocale(locale === "en" ? "zh" : "en")} className="focus-ring flex size-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:border-accent hover:text-accent" aria-label={locale === "en" ? "切换为中文" : "Switch to English"}><Languages className="size-4" /></button></nav></header>
      <main>
        <section className="hero-grid border-b border-white/[0.06] py-20 sm:py-28"><div className="page-shell"><motion.div {...reveal} transition={{ duration: 0.65 }}><p className="eyebrow">{copy.eyebrow}</p><h1 className="mt-7 max-w-5xl font-display text-4xl font-black leading-[0.92] text-white sm:text-6xl lg:text-8xl">{copy.title}</h1><p className="mt-7 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">{copy.intro}</p></motion.div></div></section>
        <section className="border-b border-white/[0.06] bg-[#0b0f14]"><div className="page-shell grid grid-cols-2 divide-x divide-white/[0.08] sm:grid-cols-4">{stats.map(({ label, value, icon: Icon }) => <div key={label} className="border-b border-white/[0.08] px-3 py-6 even:border-l-0 sm:border-b-0 sm:px-6 sm:py-8"><Icon className="mb-5 size-4 text-accent" /><p className="font-display text-3xl font-black sm:text-4xl">{value}</p><p className="mt-2 text-xs text-gray-500">{label}</p></div>)}</div></section>
        {view.cycles.length === 0 ? <section className="page-shell py-24 sm:py-32"><div className="max-w-2xl border-l-2 border-accent pl-6 sm:pl-9"><p className="font-display text-3xl font-black text-white sm:text-5xl">{copy.noData}</p><p className="mt-5 text-base leading-relaxed text-gray-400 sm:text-lg">{copy.noDataDetail}</p></div></section> : <div className="page-shell py-20 sm:py-28">{view.cycles.map((cycle) => <section key={cycle.id} className="mb-24 last:mb-0"><div className="mb-10 flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">{statusLabel(locale, cycle.status)}</p><h2 className="mt-5 font-display text-3xl font-black sm:text-5xl">{localized(locale, cycle.nameZh, cycle.nameEn)}</h2></div><p className="text-sm text-gray-500">{formatDate(locale, cycle.startDate)} — {formatDate(locale, cycle.endDate)}</p></div><div className="space-y-6">{cycle.objectives.map((objective) => <ObjectiveBlock key={objective.id} objective={objective} locale={locale} />)}</div>{cycle.reviews.length > 0 && <div className="mt-14"><h3 className="mb-6 font-display text-2xl font-black">{copy.reviews}<span className="text-accent">.</span></h3><div className="grid gap-5 lg:grid-cols-2">{cycle.reviews.map((review) => <ReviewBlock key={review.id} review={review} locale={locale} />)}</div></div>}</section>)}</div>}
      </main>
    </div>
  );
}

export function OkrExperience({ content, view }: { content: SiteContent; view: PublicOkrView }) {
  return <I18nProvider content={content}><OkrContent view={view} /></I18nProvider>;
}
