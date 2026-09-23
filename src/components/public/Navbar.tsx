"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "./i18n";
import { editableTextProps } from "./visual-editing";

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Navbar() {
  const { locale, setLocale, copy, editor } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const navItems = [
    { label: copy.nav.about, target: "about" },
    { label: copy.nav.work, target: "work" },
    { label: copy.nav.contact, target: "contact" },
  ];

  useEffect(() => {
    if (!menuOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const menuButton = menuButtonRef.current;
    const brandButton = dialog.parentElement?.querySelector<HTMLButtonElement>("nav button");
    const previousOverflow = document.documentElement.style.overflow;
    const desktop = window.matchMedia("(min-width: 640px)");
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    desktop.addEventListener("change", closeOnDesktop);
    window.addEventListener("resize", closeOnDesktop);
    closeOnDesktop();
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      window.removeEventListener("resize", closeOnDesktop);
      document.documentElement.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      (menuButton?.getClientRects().length ? menuButton : brandButton)?.focus();
    };
  }, [menuOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-white/[0.07] bg-[#0f1115]/80 backdrop-blur-xl sm:h-24">
      <nav className="page-shell relative flex h-full items-center justify-between" aria-label="Primary navigation">
        <button type="button" onClick={(event) => {
          if (editor && event.target instanceof Element && event.target.closest('[data-cms-path][contenteditable="true"]')) return;
          window.scrollTo({ top: 0, behavior: "smooth" });
        }} className="focus-ring text-lg font-black tracking-[-0.04em] sm:text-xl" aria-label={copy.nav.brand} title={copy.nav.top}>
          <span {...editableTextProps(editor, `${locale}.nav.brand`)}>{copy.nav.brand}</span><span className="text-accent">.</span>
        </button>

        <div className="ml-auto flex items-center gap-3 sm:gap-6 lg:gap-9">
          <div role="group" aria-label="Section navigation" className="hidden items-center sm:flex sm:justify-start sm:gap-6 lg:gap-9">
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
          <button ref={menuButtonRef} type="button" onClick={() => setMenuOpen(true)} className="focus-ring flex size-10 items-center justify-center rounded-full border border-white/15 text-white sm:hidden" aria-label={locale === "zh" ? "打开菜单" : "Open menu"} aria-haspopup="dialog" aria-expanded={menuOpen}>
            <Menu size={20} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => scrollToSection("contact")} className="group focus-ring hidden size-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] transition-all duration-300 hover:border-accent/60 hover:bg-accent/10 sm:flex" aria-label={copy.nav.goContact}>
            <span className="size-2.5 rounded-full bg-accent shadow-[0_0_15px_rgba(0,223,143,0.7)] transition-transform group-hover:scale-125" />
          </button>
        </div>
      </nav>
      {menuOpen && (
        <dialog ref={dialogRef} onClose={() => setMenuOpen(false)} onClick={(event) => {
          if (event.target === event.currentTarget) setMenuOpen(false);
        }} aria-label={locale === "zh" ? "导航菜单" : "Navigation menu"} className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(20rem,85vw)] max-w-none border-0 border-l border-white/10 bg-[#11161a] p-0 text-white shadow-2xl backdrop:bg-black/70 sm:hidden">
          <div className="flex h-full flex-col px-6 pb-8 pt-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <span className="text-sm font-bold tracking-widest">{locale === "zh" ? "菜单" : "MENU"}</span>
              <button ref={closeButtonRef} type="button" onClick={() => setMenuOpen(false)} className="focus-ring flex size-10 items-center justify-center rounded-full border border-white/15" aria-label={locale === "zh" ? "关闭菜单" : "Close menu"}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-1 pt-6">
              {navItems.map((item) => (
                <button key={item.target} type="button" onClick={(event) => {
                  if (editor && event.target instanceof Element && event.target.closest('[data-cms-path][contenteditable="true"]')) return;
                  setMenuOpen(false);
                  scrollToSection(item.target);
                }} className="focus-ring py-3 text-left text-lg font-semibold tracking-widest text-gray-200 hover:text-accent">
                  <span {...editableTextProps(editor, locale + ".nav." + item.target)}>{item.label}</span>
                </button>
              ))}
              <Link href="/okr" onClick={() => setMenuOpen(false)} className="focus-ring py-3 text-lg font-semibold tracking-widest text-accent hover:text-white">OKR</Link>
              <Link href="/experience" onClick={() => setMenuOpen(false)} className="focus-ring py-3 text-lg font-semibold tracking-widest text-accent hover:text-white">{locale === "zh" ? "经历" : "Journey"}</Link>
              <Link href="/knowledge" onClick={() => setMenuOpen(false)} className="focus-ring py-3 text-lg font-semibold tracking-widest text-accent hover:text-white">{locale === "zh" ? "知识库" : "Knowledge"}</Link>
            </div>
          </div>
        </dialog>
      )}
    </header>
  );
}
