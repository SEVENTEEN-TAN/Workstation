"use client";

import type { SiteContent } from "../../lib/content/schema";
import type { PublicResumeData } from "../../lib/services/public-resume";
import { About } from "./About";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { HomeCapabilities } from "./HomeCapabilities";
import { HomeJourney } from "./HomeJourney";
import { HomeNow } from "./HomeNow";
import { I18nProvider } from "./i18n";
import { Navbar } from "./Navbar";
import { RecentWorks } from "./RecentWorks";
import { Services } from "./Services";

type HomeExperienceProps = {
  content: SiteContent;
  activities?: PublicResumeData["activities"];
  skills?: PublicResumeData["skills"];
  experiences?: PublicResumeData["experiences"];
  resumeDownloads?: PublicResumeData["downloads"];
};

export function HomeExperience({ content, activities, skills, experiences, resumeDownloads }: HomeExperienceProps) {
  const composedHomepage = activities !== undefined && experiences !== undefined;

  return (
    <I18nProvider content={content}>
      <div className="min-h-screen overflow-x-hidden bg-ink text-white selection:bg-accent selection:text-ink">
        <Navbar />
        <main>
          <Hero />
          <About />
          {activities ? <HomeNow activities={activities} /> : null}
          <RecentWorks sectionNumber={composedHomepage ? "03" : undefined} />
          {skills ? <HomeCapabilities areas={skills} /> : <Services />}
          {experiences ? <HomeJourney experiences={experiences} resumeDownloads={resumeDownloads ?? { zh: false, en: false }} /> : null}
        </main>
        <Footer sectionNumber={composedHomepage ? "06" : undefined} />
      </div>
    </I18nProvider>
  );
}
