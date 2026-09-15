"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, CalendarDays, Languages, Star } from "lucide-react";
import { motion } from "framer-motion";

import type { SiteContent } from "../../lib/content/schema";
import type { PublicPortfolioProject } from "./data";
import { I18nProvider, useI18n, type Locale } from "./i18n";
import { reveal } from "./motion";

const labels = {
  en: {
    back: "All projects",
    home: "Back home",
    eyebrow: "PERSONAL WORKSTATION / PROJECTS",
    title: "WORK THAT CAN BE VERIFIED.",
    intro: "Structured project evidence: context, responsibility, challenge, approach and results in one place.",
    featured: "Featured",
    context: "Context",
    responsibility: "Responsibility",
    challenge: "Challenge",
    approach: "Approach",
    result: "Result",
    technologies: "Technology evidence",
    started: "Started",
    completed: "Completed",
    empty: "No public projects yet.",
    emptyDetail: "Projects will appear here after their bilingual evidence is complete.",
    open: "Open project",
    links: "Links",
  },
  zh: {
    back: "全部项目",
    home: "返回主页",
    eyebrow: "个人工作站 / 项目案例",
    title: "让项目经验可验证。",
    intro: "以结构化方式呈现项目背景、职责、挑战、方案与结果，形成可核查的职业证据。",
    featured: "精选",
    context: "项目背景",
    responsibility: "我的职责",
    challenge: "核心挑战",
    approach: "实现方案",
    result: "项目结果",
    technologies: "技术证据",
    started: "开始时间",
    completed: "完成时间",
    empty: "暂时没有公开项目。",
    emptyDetail: "双语项目证据整理完成并设为公开后，会出现在这里。",
    open: "查看项目",
    links: "相关链接",
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

function ProjectCover({ project, className }: { project: PublicPortfolioProject; className?: string }) {
  const { locale } = useI18n();

  if (!project.coverImage) {
    return (
      <div className={`${className} grid place-items-center bg-white/[0.035]`}>
        <span className="font-display text-4xl text-white/35 sm:text-6xl">
          {localized(locale, project.titleZh, project.titleEn).slice(0, 2)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={project.coverImage}
      alt={(locale === "zh" ? project.coverAltZh : project.coverAltEn) ?? project.titleEn}
      width="1200"
      height="800"
      loading="lazy"
      className={className}
    />
  );
}

function ProjectList({ projects }: { projects: PublicPortfolioProject[] }) {
  const { locale, setLocale } = useI18n();
  const copy = labels[locale];

  return (
    <div className="min-h-screen bg-ink text-white selection:bg-accent selection:text-ink">
      <header className="border-b border-white/[0.08] bg-[#0f1115]/90 backdrop-blur-xl">
        <nav className="page-shell flex h-20 items-center justify-between">
          <Link href="/" className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-gray-300 transition-colors hover:text-accent">
            <ArrowLeft className="size-4" />{copy.home}
          </Link>
          <button type="button" onClick={() => setLocale(locale === "en" ? "zh" : "en")} className="focus-ring flex size-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:border-accent hover:text-accent" aria-label={locale === "en" ? "切换为中文" : "Switch to English"}>
            <Languages className="size-4" />
          </button>
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
        {projects.length ? (
          <section className="page-shell py-20 sm:py-28">
            <div className="grid gap-6 md:grid-cols-2">
              {projects.map((project, index) => (
                <motion.article key={project.id} {...reveal} transition={{ duration: 0.5, delay: Math.min(index * 0.06, 0.24) }} className="border border-white/10 bg-white/[0.025]">
                  <Link href={`/projects/${project.slug}`} className="focus-ring block">
                    <ProjectCover project={project} className="aspect-[3/2] w-full object-cover" />
                  </Link>
                  <div className="p-5 sm:p-7">
                    <div className="flex flex-wrap items-center gap-3">
                      {project.featured ? <span className="inline-flex items-center gap-1.5 border border-accent/30 px-2 py-1 text-[10px] font-bold uppercase text-accent"><Star className="size-3" />{copy.featured}</span> : null}
                      <span className="text-xs font-bold uppercase tracking-[0.18em] text-gray-600">{project.technologies[0]}</span>
                    </div>
                    <h2 className="mt-4 font-display text-2xl font-black text-white sm:text-3xl">{localized(locale, project.titleZh, project.titleEn)}</h2>
                    <p className="mt-4 text-sm leading-7 text-gray-400">{localized(locale, project.summaryZh, project.summaryEn)}</p>
                    <Link href={`/projects/${project.slug}`} className="focus-ring mt-6 inline-flex items-center gap-2 text-sm font-bold text-accent hover:text-white">
                      {copy.open}<ArrowUpRight className="size-4" />
                    </Link>
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

function ProjectDetail({ project }: { project: PublicPortfolioProject }) {
  const { locale, setLocale } = useI18n();
  const copy = labels[locale];
  const evidence = [
    [copy.context, localized(locale, project.contextZh, project.contextEn)],
    [copy.responsibility, localized(locale, project.responsibilityZh, project.responsibilityEn)],
    [copy.challenge, localized(locale, project.challengeZh, project.challengeEn)],
    [copy.approach, localized(locale, project.approachZh, project.approachEn)],
    [copy.result, localized(locale, project.resultZh, project.resultEn)],
  ] as const;

  return (
    <div className="min-h-screen bg-ink text-white selection:bg-accent selection:text-ink">
      <header className="border-b border-white/[0.08] bg-[#0f1115]/90 backdrop-blur-xl">
        <nav className="page-shell flex h-20 items-center justify-between">
          <Link href="/projects" className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-gray-300 transition-colors hover:text-accent">
            <ArrowLeft className="size-4" />{copy.back}
          </Link>
          <button type="button" onClick={() => setLocale(locale === "en" ? "zh" : "en")} className="focus-ring flex size-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:border-accent hover:text-accent" aria-label={locale === "en" ? "切换为中文" : "Switch to English"}>
            <Languages className="size-4" />
          </button>
        </nav>
      </header>
      <main>
        <section className="hero-grid border-b border-white/[0.06] py-16 sm:py-24">
          <div className="page-shell">
            <motion.div {...reveal} transition={{ duration: 0.6 }}>
              <p className="eyebrow">{project.technologies.slice(0, 3).join(" / ")}</p>
              <h1 className="mt-6 max-w-5xl font-display text-4xl font-black leading-[0.94] text-white sm:text-6xl lg:text-7xl">{localized(locale, project.titleZh, project.titleEn)}</h1>
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-gray-400 sm:text-lg">{localized(locale, project.summaryZh, project.summaryEn)}</p>
            </motion.div>
          </div>
        </section>
        <div className="page-shell grid gap-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.8fr)]">
          <div>
            {project.coverImage ? <ProjectCover project={project} className="mb-10 aspect-[3/2] w-full border border-white/10 object-cover" /> : null}
            <dl className="grid gap-8 md:grid-cols-2">
              {evidence.map(([term, detail]) => (
                <div key={term} className="border border-white/10 bg-white/[0.025] p-5 sm:p-6">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">{term}</dt>
                  <dd className="mt-3 text-sm leading-7 text-gray-300">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          <aside className="space-y-8">
            <section className="border border-white/10 bg-white/[0.025] p-5 sm:p-6">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">{copy.technologies}</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {project.technologies.map((technology) => <span key={technology} className="border border-white/10 px-3 py-2 text-xs text-gray-400">{technology}</span>)}
              </div>
            </section>
            {project.startedAt || project.completedAt ? (
              <section className="border-l-2 border-accent bg-white/[0.025] p-5 sm:p-6">
                <dl className="space-y-4 text-sm">
                  {project.startedAt ? <div><dt className="text-xs uppercase tracking-[0.18em] text-gray-600">{copy.started}</dt><dd className="mt-2 flex items-center gap-2 text-gray-300"><CalendarDays className="size-4 text-accent" />{formatDate(locale, project.startedAt)}</dd></div> : null}
                  {project.completedAt ? <div><dt className="text-xs uppercase tracking-[0.18em] text-gray-600">{copy.completed}</dt><dd className="mt-2 flex items-center gap-2 text-gray-300"><CalendarDays className="size-4 text-accent" />{formatDate(locale, project.completedAt)}</dd></div> : null}
                </dl>
              </section>
            ) : null}
            {project.links.length ? (
              <section className="border border-white/10 bg-white/[0.025] p-5 sm:p-6">
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">{copy.links}</h2>
                <ul className="mt-5 space-y-3">
                  {project.links.map((link) => (
                    <li key={link.url}>
                      <a href={link.url} target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-2 text-sm font-bold text-accent hover:text-white">
                        {localized(locale, link.labelZh, link.labelEn)}<ArrowUpRight className="size-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      </main>
    </div>
  );
}

export function ProjectExperience({
  content,
  projects,
  project,
}: {
  content: SiteContent;
  projects: PublicPortfolioProject[];
  project?: PublicPortfolioProject;
}) {
  return (
    <I18nProvider content={content}>
      {project ? <ProjectDetail project={project} /> : <ProjectList projects={projects} />}
    </I18nProvider>
  );
}
