"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { toRecentProjectViews, type PublicPortfolioProject } from "./data";
import { useI18n } from "./i18n";
import { luxuryEase, reveal } from "./motion";

export function RecentWorks({ projects: structuredProjects = [] }: { projects?: PublicPortfolioProject[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const reduceMotion = useReducedMotion();
  const { copy, locale } = useI18n();
  const projects = toRecentProjectViews(locale, structuredProjects, copy.projects);
  const activeProject = projects[activeIdx] ?? projects[0];

  if (!activeProject) return null;

  const activateCard = (index: number) => setActiveIdx(index === activeIdx ? (activeIdx + 1) % projects.length : index);

  return (
    <section id="work" className="scroll-mt-20 py-24 sm:py-32">
      <div className="page-shell">
        <motion.div {...reveal} transition={{ duration: 0.7 }} className="mb-16 flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="eyebrow">{copy.works.eyebrow}</p><h2 className="section-heading mt-7">{copy.works.heading}</h2></div>
          <Link href="/projects" className="text-link focus-ring group self-start sm:self-auto">{copy.works.viewAll}<ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
        </motion.div>

        <div className="grid items-start gap-16 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <div className="relative h-[340px] [perspective:1200px] sm:h-[450px] md:h-[480px]">
              {projects.map((project, index) => {
                const diff = (index - activeIdx + projects.length) % projects.length;
                return (
                  <motion.button key={project.slug ?? project.title} type="button" onClick={() => activateCard(index)} aria-label={`${copy.works.project} ${index + 1}: ${project.title}`} animate={reduceMotion ? { opacity: diff === 0 ? 1 : 0.7 } : { y: diff * 35, scale: 1 - diff * 0.05, rotateX: diff * 2, opacity: 1 - diff * 0.13 }} transition={{ duration: reduceMotion ? 0.01 : 0.7, ease: luxuryEase }} style={{ zIndex: projects.length - diff, transformOrigin: "top center" }} className="focus-ring absolute inset-x-0 top-0 block h-[290px] w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-surface text-left shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:h-[390px] md:h-[420px]">
                    {project.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={project.image} alt={project.alt} width="1200" height="800" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.025]" />
                    ) : (
                      <span className="grid h-full w-full place-items-center bg-white/[0.035] px-6 text-center font-display text-2xl font-black text-white/40 sm:text-4xl">{project.title}</span>
                    )}
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-white/[0.04]" /><span className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] font-bold tracking-widest text-white backdrop-blur-md sm:left-7 sm:top-7">0{index + 1}</span>
                  </motion.button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center gap-2 sm:mt-8 sm:gap-3" aria-label={copy.works.navigation}>
              {projects.map((project, index) => <button key={project.title} type="button" onClick={() => setActiveIdx(index)} aria-label={`${copy.works.showProject} ${index + 1}`} aria-current={index === activeIdx ? "true" : undefined} className="focus-ring group flex h-7 items-center"><span className={`h-1.5 rounded-full transition-all duration-500 ${index === activeIdx ? "w-10 bg-accent" : "w-4 bg-white/20 group-hover:bg-white/45"}`} /></button>)}
              <span className="ml-2 text-xs tracking-widest text-gray-600">0{activeIdx + 1} / 0{projects.length}</span>
            </div>
          </div>

          <div className="lg:col-span-5 lg:pl-8">
            <AnimatePresence mode="wait">
              <motion.div key={activeProject.title} initial={{ opacity: 0, y: reduceMotion ? 0 : 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -16 }} transition={{ duration: reduceMotion ? 0.01 : 0.45, ease: luxuryEase }}>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">{activeProject.category}</p><h3 className="mt-6 font-display text-4xl font-black leading-none tracking-tighter sm:text-5xl lg:text-6xl">{activeProject.title}</h3><p className="mt-7 max-w-lg text-base leading-relaxed text-gray-400 sm:text-lg">{activeProject.description}</p>
                <div className="mt-8 flex flex-wrap gap-2">{activeProject.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 px-3.5 py-2 text-xs text-gray-400">{tag}</span>)}</div>
                <Link href={activeProject.slug ? `/projects/${activeProject.slug}` : "/projects"} className="primary-button focus-ring group mt-10">{copy.works.explore}<ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
