"use client";

import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, GraduationCap } from "lucide-react";
import { motion } from "framer-motion";

import type { PublicResumeData } from "../../lib/services/public-resume";
import { useI18n, type Locale } from "./i18n";
import { reveal } from "./motion";

const labels = {
  en: { eyebrow: "05 — JOURNEY", heading: "A TRACEABLE PATH.", intro: "A concise view of the work and education experiences behind my engineering judgment.", present: "Present", viewAll: "View full journey", resume: "Open resume", empty: "Public work and education records will appear here when they are ready." },
  zh: { eyebrow: "05 — 职业路径", heading: "让成长路径可追溯。", intro: "用精简时间线说明工作与教育经历，以及工程判断是如何持续形成的。", present: "至今", viewAll: "查看完整经历", resume: "打开在线简历", empty: "公开的工作与教育经历准备完成后，会出现在这里。" },
} as const;

function localized(locale: Locale, zh: string, en: string | null) {
  return locale === "zh" || !en ? zh : en;
}

function year(value: string) {
  return new Date(value).getUTCFullYear();
}

export function HomeJourney({ experiences }: { experiences: PublicResumeData["experiences"]; resumeDownloads: PublicResumeData["downloads"] }) {
  const { locale } = useI18n();
  const copy = labels[locale];
  const recent = experiences.slice(0, 3);

  return (
    <section id="journey" className="scroll-mt-20 py-24 sm:py-32">
      <div className="page-shell">
        <motion.div {...reveal} transition={{ duration: 0.7 }} className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 className="section-heading mt-7">{copy.heading}</h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">{copy.intro}</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/experience" className="text-link focus-ring group">{copy.viewAll}<ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
            <Link href="/resume" className="text-link focus-ring group">{copy.resume}<ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
          </div>
        </motion.div>

        {recent.length ? (
          <div className="relative mt-14 ml-2 border-l border-white/10 sm:ml-32">
            {recent.map((experience, index) => (
              <motion.article key={experience.id} {...reveal} transition={{ duration: 0.55, delay: index * 0.08 }} className="relative mb-6 pl-7 last:mb-0 sm:pl-12">
                <span className="absolute -left-1.5 top-7 size-3 border border-accent bg-ink" />
                <time className="mb-3 block text-xs font-bold uppercase tracking-[0.14em] text-gray-600 sm:absolute sm:right-full sm:top-6 sm:mr-10 sm:w-24 sm:text-right">{year(experience.startedAt)} — {experience.isCurrent ? copy.present : experience.endedAt ? year(experience.endedAt) : "—"}</time>
                <div className="border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">{experience.kind === "WORK" ? <BriefcaseBusiness className="size-4" /> : <GraduationCap className="size-4" />}{localized(locale, experience.titleZh, experience.titleEn)}</div>
                  <h3 className="mt-4 font-display text-2xl font-black text-white sm:text-3xl">{localized(locale, experience.organizationZh, experience.organizationEn)}</h3>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-400 sm:text-base">{localized(locale, experience.descriptionZh, experience.descriptionEn)}</p>
                </div>
              </motion.article>
            ))}
          </div>
        ) : <p className="mt-12 max-w-2xl border-l-2 border-accent pl-6 text-base leading-relaxed text-gray-400">{copy.empty}</p>}
      </div>
    </section>
  );
}
