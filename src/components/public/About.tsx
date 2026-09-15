"use client";

import { motion, useReducedMotion } from "framer-motion";

import { useI18n } from "./i18n";
import { reveal } from "./motion";

export function About() {
  const reduceMotion = useReducedMotion();
  const { copy } = useI18n();

  return (
    <section id="about" className="scroll-mt-20 border-y border-white/[0.06] bg-[#0b0f14] py-24 sm:py-32">
      <div className="page-shell grid gap-16 lg:grid-cols-2 lg:gap-24">
        <motion.div {...reveal} transition={{ duration: 0.7 }}>
          <p className="eyebrow">{copy.about.eyebrow}</p>
          <h2 aria-label={copy.about.headingLabel} className="section-heading mt-7 max-w-2xl">{copy.about.heading[0]}<br />{copy.about.heading[1].replace(".", "")}<span className="text-accent">.</span></h2>
          <div className="mt-9 max-w-xl space-y-5 text-base leading-relaxed text-gray-400 sm:text-lg">{copy.about.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          <div className="mt-12 grid max-w-lg grid-cols-2 border-t border-white/10 pt-8">
            {copy.about.stats.map((stat, index) => (
              <div key={stat.label} className={index === 0 ? "pr-5 sm:pr-7" : "border-l border-white/10 pl-5 sm:pl-7"}>
                <p className="font-display text-2xl font-black tracking-tighter sm:text-3xl">{stat.value}<span className="text-accent">{stat.accent}</span></p>
                <p className="mt-2 text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div {...reveal} transition={{ delay: 0.15, duration: 0.7 }} className="self-center rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20 backdrop-blur-md sm:p-10">
          <div className="mb-10 flex items-center justify-between border-b border-white/10 pb-6"><h3 className="font-display text-2xl font-bold tracking-tight">{copy.about.toolkit}</h3><span className="text-xs font-semibold tracking-widest text-gray-500">{copy.about.skillCount}</span></div>
          <div className="flex flex-wrap gap-3">
            {copy.about.skills.map((skill, index) => (
              <motion.span key={skill} initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ delay: index * 0.1, duration: 0.6 }} className="rounded-full border border-white/10 bg-black/20 px-4 py-2.5 text-sm font-medium text-gray-300 transition-all duration-300 hover:border-accent hover:text-accent hover:shadow-[0_0_15px_rgba(0,223,143,0.3)] sm:px-5">
                {skill}
              </motion.span>
            ))}
          </div>
          <div className="mt-12 grid grid-cols-[auto_1fr] items-center gap-5 border-t border-white/10 pt-7"><span className="flex size-11 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-sm font-bold text-accent">Z</span><p className="text-sm leading-relaxed text-gray-500">{copy.about.quote}</p></div>
        </motion.div>
      </div>
    </section>
  );
}
