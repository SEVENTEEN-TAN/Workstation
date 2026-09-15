"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Languages, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import type { SiteContent } from "../../lib/content/schema";
import type { PublicSkillArea } from "../../lib/services/skill-capabilities";
import { I18nProvider, useI18n, type Locale } from "./i18n";
import { reveal } from "./motion";

export type { PublicSkillArea } from "../../lib/services/skill-capabilities";

const labels = {
  en: {
    back: "Back home",
    eyebrow: "PERSONAL WORKSTATION / CAPABILITY",
    title: "SKILLS WITH EVIDENCE.",
    intro: "Capability areas, concrete skills and the projects or articles that support them.",
    evidence: "Evidence",
    project: "Project",
    article: "Article",
    empty: "No public capability areas yet",
    emptyDetail: "Bilingual capability areas with resolvable project or article evidence will appear here.",
  },
  zh: {
    back: "返回主页",
    eyebrow: "个人工作站 / 能力",
    title: "让能力有证据。",
    intro: "按能力域整理技能，并关联能支撑它的项目或文章。",
    evidence: "证据",
    project: "项目",
    article: "文章",
    empty: "暂时没有公开能力域",
    emptyDetail: "双语完整且证据可解析的能力域整理完成后，会出现在这里。",
  },
} as const;

function localized(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

function CapabilityContent({ areas }: { areas: readonly PublicSkillArea[] }) {
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
        {areas.length ? (
          <section className="page-shell space-y-8 py-20 sm:py-28">
            {areas.map((area, areaIndex) => (
              <motion.section key={area.id} {...reveal} transition={{ duration: 0.5, delay: Math.min(areaIndex * 0.06, 0.24) }} className="border-t border-white/10 pt-8 sm:pt-10">
                <div className="flex items-center gap-3">
                  <Sparkles className="size-4 text-accent" />
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{copy.evidence}</p>
                </div>
                <h2 className="mt-5 font-display text-2xl font-black text-white sm:text-3xl">{localized(locale, area.nameZh, area.nameEn)}</h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-400 sm:text-base">{localized(locale, area.descriptionZh, area.descriptionEn)}</p>
                <div className="mt-7 grid gap-4 lg:grid-cols-2">
                  {area.skills.map((skill) => (
                    <div key={skill.id} className="border border-white/10 bg-ink/40 p-5">
                      <h3 className="text-lg font-bold text-white">{localized(locale, skill.nameZh, skill.nameEn)}</h3>
                      <p className="mt-3 text-sm leading-7 text-gray-400">{localized(locale, skill.summaryZh, skill.summaryEn)}</p>
                      {skill.evidence.length ? (
                        <div className="mt-5">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-600">{copy.evidence}</p>
                          <ul className="mt-3 space-y-2">
                            {skill.evidence.map((evidence) => (
                              <li key={evidence.id}>
                                <a href={evidence.url} target={evidence.kind === "ARTICLE" ? "_blank" : undefined} rel={evidence.kind === "ARTICLE" ? "noreferrer" : undefined} className="focus-ring inline-flex items-center gap-2 text-sm font-bold text-accent hover:text-white">
                                  <span className="border border-white/10 px-2 py-1 text-[10px] uppercase text-gray-500">{evidence.kind === "PROJECT" ? copy.project : copy.article}</span>
                                  {localized(locale, evidence.titleZh, evidence.titleEn)}
                                  <ArrowUpRight className="size-4" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </motion.section>
            ))}
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

export function SkillCapabilitiesExperience({
  content,
  areas,
  initialLocale = "zh",
}: {
  content: SiteContent;
  areas: readonly PublicSkillArea[];
  initialLocale?: Locale;
}) {
  return (
    <I18nProvider content={content} initialLocale={initialLocale}>
      <CapabilityContent areas={areas} />
    </I18nProvider>
  );
}
