"use client";

import type { SiteContent } from "../../lib/content/schema";
import { About } from "./About";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { I18nProvider } from "./i18n";
import { Navbar } from "./Navbar";
import { RecentWorks } from "./RecentWorks";
import { Services } from "./Services";
import type { PublicPortfolioProject } from "./data";

export function HomeExperience({ content, projects = [] }: { content: SiteContent; projects?: PublicPortfolioProject[] }) {
  return (
    <I18nProvider content={content}>
      <div className="min-h-screen overflow-x-hidden bg-ink text-white selection:bg-accent selection:text-ink">
        <Navbar />
        <main>
          <Hero />
          <About />
          <RecentWorks projects={projects} />
          <Services />
        </main>
        <Footer />
      </div>
    </I18nProvider>
  );
}
