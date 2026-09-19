"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { shouldEnableCardDrag } from "./drag";
import { useI18n } from "./i18n";
import { reveal } from "./motion";

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export function Hero() {
  const dragArea = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { locale, copy } = useI18n();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const dragEnabled = shouldEnableCardDrag(reduceMotion, isDesktop);
  const headingSize = isCompact ? "text-[clamp(1.125rem,6vw,1.9rem)] tracking-[-0.04em]" : "text-[clamp(3rem,6.5vw,6rem)] tracking-[-0.065em]";

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    const compactMedia = window.matchMedia("(max-width: 767px)");
    const updateDesktop = (event: MediaQueryListEvent | MediaQueryList) => setIsDesktop(event.matches);
    const updateCompact = (event: MediaQueryListEvent | MediaQueryList) => setIsCompact(event.matches);
    updateDesktop(desktopMedia);
    updateCompact(compactMedia);
    desktopMedia.addEventListener("change", updateDesktop);
    compactMedia.addEventListener("change", updateCompact);
    return () => {
      desktopMedia.removeEventListener("change", updateDesktop);
      compactMedia.removeEventListener("change", updateCompact);
    };
  }, []);

  return (
    <section id="identity" className="hero-grid relative flex scroll-mt-20 items-start overflow-hidden pb-16 pt-28 sm:pt-32 md:min-h-screen md:items-center md:pb-0">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
        <span className="font-display text-[23vw] font-black leading-none tracking-[-0.08em] text-white opacity-[0.018]">{copy.hero.backdrop}</span>
      </div>
      <div className="pointer-events-none absolute left-[12%] top-[20%] size-72 rounded-full bg-accent/[0.035] blur-[120px]" />

      <div className="page-shell relative z-10 grid w-full items-center gap-16 md:grid-cols-2 md:gap-7 lg:gap-8">
        <motion.div {...reveal} transition={{ duration: 0.75 }} className="max-w-3xl pt-4 lg:pt-0">
          <div className={isCompact ? "hero-heading-zone" : undefined}>
            <div className="mb-8 flex items-center gap-3 text-xs font-bold tracking-[0.28em] text-gray-400 sm:text-sm">
              <span className="size-2 shrink-0 rounded-full bg-accent shadow-[0_0_12px_rgba(0,223,143,0.65)]" />
              {copy.hero.role}
            </div>
            <h1 aria-label={copy.hero.headingLabel} className={`font-display font-black leading-[0.84] ${headingSize}`}>
              <span className="block text-white">{copy.hero.lineOne}</span>
              <span className={`outline-title block ${locale === "en" ? "whitespace-nowrap" : ""}`}>{copy.hero.lineTwo}<span className="solid-dot">.</span></span>
            </h1>
          </div>
          <p className={`${isCompact ? "mt-6" : "mt-9"} max-w-xl text-base leading-relaxed text-gray-400 sm:text-lg`}>{copy.hero.intro}</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <button type="button" onClick={() => scrollTo("work")} className="primary-button focus-ring group">{copy.hero.work}<ArrowDownRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5" /></button>
            <button type="button" onClick={() => scrollTo("contact")} className="secondary-button focus-ring group"><span className="size-2 rounded-full bg-accent" />{copy.hero.contact}<ArrowUpRight className="size-4 text-gray-400 transition-colors group-hover:text-accent" /></button>
          </div>
        </motion.div>

        <div ref={dragArea} className={`${isCompact ? "absolute right-5 top-4 z-20 w-[clamp(112px,25vw,156px)] sm:right-8 sm:top-8" : "relative flex min-h-[500px] items-center justify-center lg:min-h-[620px]"} hero-badge-slot`} aria-label={copy.hero.badgeArea} data-mobile-placement={isCompact ? "top-right" : undefined}>
          <motion.div animate={dragEnabled ? { y: [0, -15, 0], rotateZ: [-1, 1, -1] } : undefined} transition={dragEnabled ? { duration: 5.5, repeat: Infinity, ease: "easeInOut" } : undefined} className={isCompact ? "relative w-full" : "relative"}>
            <motion.div drag={dragEnabled} dragElastic={0.2} dragConstraints={dragArea} dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }} whileDrag={{ scale: 1.025, cursor: "grabbing" }} className="relative pointer-events-none lg:pointer-events-auto lg:cursor-grab lg:touch-none" role="group" aria-label={copy.hero.badgeLabel} data-drag-enabled={dragEnabled}>
              <div className="lanyard" aria-hidden="true"><div className="lanyard-copy">SEVENTEEN — JAVA + AI — SEVENTEEN —</div></div>
              <div className="id-card">
                <div className="absolute left-1/2 top-2 z-20 h-2 w-10 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 md:top-4 md:h-3 md:w-16" />
                {/* The native image preserves the legacy browser sizing and loading behavior. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/zedian-portrait-v3.png" alt={copy.hero.portraitAlt} width="1024" height="1280" loading="eager" fetchPriority="high" className="h-full w-full rounded-[1rem] object-cover grayscale-[0.1] md:rounded-[1.55rem]" />
                <div className="absolute inset-x-0 bottom-0 rounded-b-[1rem] bg-gradient-to-t from-[#090c10] via-[#090c10]/85 to-transparent px-3 pb-3 pt-14 md:rounded-b-[1.55rem] md:px-7 md:pb-7 md:pt-28">
                  <div className="mb-1.5 h-px w-full bg-gradient-to-r from-accent/70 to-transparent md:mb-3" />
                  <p className="font-display text-base font-extrabold tracking-tight md:text-3xl">SEVENTEEN<span className="text-accent">.</span></p>
                  <div className="mt-1 flex items-center justify-between gap-4"><p className="text-[9px] leading-tight text-gray-400 md:text-sm">{copy.hero.badgeRole}</p><span className="hidden rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-accent md:inline-flex">{copy.hero.active}</span></div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
