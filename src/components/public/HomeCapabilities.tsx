"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

import type { PublicResumeData } from "../../lib/services/public-resume";
import { useI18n, type Locale } from "./i18n";
import { reveal } from "./motion";
import { Services } from "./Services";

const labels = {
  en: { eyebrow: "04 — CAPABILITY", heading: "SKILLS WITH EVIDENCE.", intro: "Capability areas supported by concrete projects and published work.", viewAll: "View capability evidence" },
  zh: { eyebrow: "04 — 能力", heading: "让能力有证据。", intro: "按能力域呈现技术栈，并通过具体项目与公开成果提供支撑。", viewAll: "查看完整能力证据" },
} as const;

function localized(locale: Locale, zh: string, en: string) {
  return locale === "zh" ? zh : en;
}

export function HomeCapabilities({ areas }: { areas: PublicResumeData["skills"] }) {
  const { locale } = useI18n();
  const copy = labels[locale];
  if (!areas.length) return <Services sectionNumber="04" />;

  return (
    <section id="capability" className="scroll-mt-20 border-t border-white/[0.06] bg-[#0b0f14] py-24 sm:py-32">
      <div className="page-shell">
        <motion.div {...reveal} transition={{ duration: 0.7 }} className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 className="section-heading mt-7">{copy.heading}</h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">{copy.intro}</p>
          </div>
          <Link href="/skills" className="text-link focus-ring group self-start sm:self-auto">{copy.viewAll}<ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
        </motion.div>

        <div className="mt-14 border-t border-white/10">
          {areas.slice(0, 3).map((area, index) => (
            <motion.article key={area.id} {...reveal} transition={{ duration: 0.55, delay: index * 0.08 }} className="grid gap-6 border-b border-white/10 py-8 lg:grid-cols-[minmax(14rem,0.7fr)_1.3fr] lg:gap-16 lg:py-10">
              <div>
                <p className="text-xs font-bold tracking-[0.2em] text-accent">0{index + 1}</p>
                <h3 className="mt-4 font-display text-2xl font-black tracking-tight text-white sm:text-3xl">{localized(locale, area.nameZh, area.nameEn)}</h3>
                <p className="mt-4 text-sm leading-7 text-gray-400">{localized(locale, area.descriptionZh, area.descriptionEn)}</p>
              </div>
              <div className="flex flex-wrap content-start gap-3">
                {area.skills.slice(0, 6).map((skill) => <span key={skill.id} className="border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-medium text-gray-300">{localized(locale, skill.nameZh, skill.nameEn)}</span>)}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
