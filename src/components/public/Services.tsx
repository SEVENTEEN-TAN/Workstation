"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useI18n } from "./i18n";
import { reveal } from "./motion";
import { editableTextProps } from "./visual-editing";

export function Services({ sectionNumber }: { sectionNumber?: string } = {}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();
  const { copy, locale, editor } = useI18n();

  return (
    <section id="capability" className="scroll-mt-20 border-t border-white/[0.06] bg-[#0b0f14] py-24 sm:py-32">
      <div className="page-shell">
        <motion.div {...reveal} transition={{ duration: 0.7 }} className="mx-auto max-w-5xl text-center"><p {...editableTextProps(editor, `${locale}.services.eyebrow`)} className="eyebrow justify-center">{sectionNumber ? copy.services.eyebrow.replace(/^\d{2}/, sectionNumber) : copy.services.eyebrow}</p><h2 aria-label={copy.services.headingLabel} className="section-heading mx-auto mt-7 max-w-5xl"><span {...editableTextProps(editor, `${locale}.services.headingStart`)}>{copy.services.headingStart}</span> <span {...editableTextProps(editor, `${locale}.services.headingOutline`)} className="outline-title inline-block">{copy.services.headingOutline}</span></h2></motion.div>
        <div className="mx-auto mt-16 max-w-4xl border-t border-white/10 sm:mt-20">
          {copy.services.items.map(([title, description], index) => {
            const isOpen = openIndex === index;
            const panelId = `service-panel-${index}`;
            return (
              <motion.div key={title} initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} transition={{ delay: index * 0.1, duration: 0.6 }} className="border-b border-white/10">
                <button type="button" onClick={(event) => {
                  if (editor && event.target instanceof Element && event.target.closest('[data-cms-path][contenteditable="true"]')) return;
                  setOpenIndex(isOpen ? null : index);
                }} aria-expanded={isOpen} aria-controls={panelId} className="focus-ring group grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-6 text-left sm:grid-cols-[4rem_1fr_auto] sm:gap-6 sm:py-8">
                  <span className={`text-xs font-bold tracking-widest transition-colors ${isOpen ? "text-accent" : "text-gray-600"}`}>0{index + 1}</span><span {...editableTextProps(editor, `${locale}.services.items.${index}.0`)} className={`font-display text-xl font-black tracking-tight transition-colors min-[390px]:text-2xl sm:text-4xl ${isOpen ? "text-white" : "text-gray-400 group-hover:text-white"}`}>{title}</span><span className={`flex size-10 items-center justify-center rounded-full border transition-all sm:size-12 ${isOpen ? "rotate-0 border-accent bg-accent text-ink" : "border-white/15 text-white group-hover:border-accent group-hover:text-accent"}`}>{isOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}</span>
                </button>
                <AnimatePresence initial={false}>{isOpen && <motion.div id={panelId} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduceMotion ? 0.01 : 0.4 }} className="overflow-hidden"><p {...editableTextProps(editor, `${locale}.services.items.${index}.1`)} className="max-w-2xl pb-8 pl-[3.25rem] text-base leading-relaxed text-gray-400 sm:pb-10 sm:pl-[5.5rem] sm:text-lg">{description}</p></motion.div>}</AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
