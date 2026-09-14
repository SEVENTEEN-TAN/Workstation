"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowUpRight, Code2, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

import { useI18n } from "./i18n";
import { reveal } from "./motion";

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

export function Footer() {
  const { copy } = useI18n();
  const menu = copy.footer.links.map((label, index) => [label, ["about", "work", "contact"][index]] as const);

  return (
    <footer id="contact" className="relative scroll-mt-20 overflow-hidden border-t border-white/10 bg-ink pb-10 pt-24 sm:pt-32">
      <div className="pointer-events-none absolute inset-x-0 bottom-[-3vw] overflow-hidden text-center" aria-hidden="true"><span className="font-display text-[25vw] font-black leading-none tracking-[-0.08em] text-white opacity-[0.035]">{copy.footer.backdrop}</span></div>
      <div className="page-shell relative z-10">
        <motion.div {...reveal} transition={{ duration: 0.7 }} className="grid gap-16 border-b border-white/10 pb-20 lg:grid-cols-2 lg:gap-24">
          <div><p className="eyebrow">{copy.footer.eyebrow}</p><h2 aria-label={copy.footer.headingLabel} className="section-heading mt-7">{copy.footer.heading[0]}<br /><span className="text-accent">{copy.footer.heading[1]}</span></h2><p className="mt-7 max-w-lg text-base leading-relaxed text-gray-400 sm:text-lg">{copy.footer.intro}</p><a href="mailto:m13145215766@163.com" className="focus-ring mt-9 inline-flex items-center gap-3 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-black transition-transform duration-300 hover:scale-105 sm:px-7">m13145215766@163.com<ArrowUpRight className="size-4" /></a></div>
          <div className="grid grid-cols-2 gap-10 self-end sm:gap-20 lg:justify-self-end">
            <div><p className="mb-6 text-xs font-bold uppercase tracking-[0.22em] text-gray-600">{copy.footer.menu}</p><ul className="space-y-4">{menu.map(([label, id]) => <li key={id}><button type="button" onClick={() => scrollTo(id)} className="focus-ring text-base text-gray-300 transition-colors hover:text-accent">{label}</button></li>)}</ul></div>
            <div><p className="mb-6 text-xs font-bold uppercase tracking-[0.22em] text-gray-600">{copy.footer.socials}</p><ul className="space-y-4 text-base text-gray-300"><li><a href="https://github.com/SEVENTEEN-TAN" target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-2 transition-colors hover:text-accent"><Code2 className="size-4" />{copy.footer.github}</a></li><li className="group/wechat relative"><button type="button" aria-label={copy.footer.wechatHint} aria-describedby="wechat-qr" className="focus-ring inline-flex items-center gap-2 transition-colors hover:text-accent"><MessageCircle className="size-4" />{copy.footer.wechat}</button><div id="wechat-qr" className="invisible absolute bottom-full right-0 z-20 mb-4 w-44 translate-y-2 rounded-2xl border border-white/10 bg-white p-2 opacity-0 shadow-2xl shadow-black/60 transition-all duration-300 group-hover/wechat:visible group-hover/wechat:translate-y-0 group-hover/wechat:opacity-100 group-focus-within/wechat:visible group-focus-within/wechat:translate-y-0 group-focus-within/wechat:opacity-100"><img src="/images/wechat-qr.png" alt={copy.footer.wechatAlt} width="648" height="633" loading="lazy" className="h-auto w-full rounded-xl" /></div></li></ul></div>
          </div>
        </motion.div>
        <div className="relative z-10 flex flex-col gap-4 pt-8 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between"><p>{copy.footer.copyright}</p><div className="flex gap-6"><span>{copy.footer.privacy}</span><span>{copy.footer.terms}</span></div></div>
      </div>
    </footer>
  );
}
