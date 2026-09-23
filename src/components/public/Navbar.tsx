"use client";

import Link from "next/link";

import { useI18n } from "./i18n";
import { editableTextProps } from "./visual-editing";

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Navbar() {
  const { locale, setLocale, copy, editor } = useI18n();
  const navItems = [
    { label: copy.nav.about, target: "about" },
    { label: copy.nav.work, target: "work" },
    { label: copy.nav.contact, target: "contact" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-24 border-b border-white/[0.07] bg-[#0f1115]/80 backdrop-blur-xl sm:h-24">
      <nav className="page-shell relative flex h-full items-start justify-between pt-4 sm:items-center sm:pt-0" aria-label="Primary navigation">
        <button type="button" onClick={(event) => {
          if (editor && event.target instanceof Element && event.target.closest('[data-cms-path][contenteditable="true"]')) return;
          window.scrollTo({ top: 0, behavior: "smooth" });
        }} className="focus-ring text-lg font-black tracking-[-0.04em] sm:text-xl" aria-label={copy.nav.brand} title={copy.nav.top}>
          <span {...editableTextProps(editor, `${locale}.nav.brand`)}>{copy.nav.brand}</span><span className="text-accent">.</span>
        </button>

        <div className="ml-auto flex items-center gap-3 sm:gap-6 lg:gap-9">
          <div role="group" aria-label="Section navigation" className="absolute inset-x-5 bottom-2 grid grid-cols-3 items-center justify-items-center gap-y-1 sm:static sm:flex sm:justify-start sm:gap-6 lg:gap-9">
            {navItems.map((item) => (
              <button key={item.target} type="button" onClick={(event) => {
                if (editor && event.target instanceof Element && event.target.closest('[data-cms-path][contenteditable="true"]')) return;
                scrollToSection(item.target);
              }} className="focus-ring text-xs font-semibold tracking-[0.14em] text-gray-300 transition-colors duration-300 hover:text-accent sm:text-sm sm:tracking-widest">
                <span {...editableTextProps(editor, `${locale}.nav.${item.target}`)}>{item.label}</span>
              </button>
            ))}
            <Link href="/okr" className="focus-ring text-xs font-semibold tracking-[0.14em] text-accent transition-colors duration-300 hover:text-white sm:text-sm sm:tracking-widest">
              OKR
            </Link>
            <Link href="/experience" className="focus-ring text-xs font-semibold tracking-[0.14em] text-accent transition-colors duration-300 hover:text-white sm:text-sm sm:tracking-widest">
              {locale === "zh" ? "经历" : "Journey"}
            </Link>
            <Link href="/knowledge" className="focus-ring text-xs font-semibold tracking-[0.14em] text-accent transition-colors duration-300 hover:text-white sm:text-sm sm:tracking-widest">
              {locale === "zh" ? "知识库" : "Knowledge"}
            </Link>
          </div>
          <button type="button" onClick={() => setLocale(locale === "en" ? "zh" : "en")} className="focus-ring flex h-9 min-w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.035] px-3 text-[11px] font-black tracking-wider text-white transition-all hover:border-accent hover:text-accent sm:h-11" aria-label={copy.nav.switchLanguage}>
            {copy.nav.switchLabel}
          </button>
          <button type="button" onClick={() => scrollToSection("contact")} className="group focus-ring hidden size-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] transition-all duration-300 hover:border-accent/60 hover:bg-accent/10 sm:flex" aria-label={copy.nav.goContact}>
            <span className="size-2.5 rounded-full bg-accent shadow-[0_0_15px_rgba(0,223,143,0.7)] transition-transform group-hover:scale-125" />
          </button>
        </div>
      </nav>
    </header>
  );
}
