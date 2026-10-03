"use client";

import { Fragment } from "react";

import type { SiteContent } from "../../lib/content/schema";
import { selectHomepageRecords } from "../../lib/content/homepage-composition";
import type { PublicResumeData } from "../../lib/services/public-resume";
import { About } from "./About";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { HomeCapabilities } from "./HomeCapabilities";
import { HomeJourney } from "./HomeJourney";
import { HomeNow } from "./HomeNow";
import { I18nProvider, type Locale } from "./i18n";
import { Navbar } from "./Navbar";
import { RecentWorks } from "./RecentWorks";
import { Services } from "./Services";

type HomeExperienceProps = {
  content: SiteContent;
  activities?: PublicResumeData["activities"];
  skills?: PublicResumeData["skills"];
  experiences?: PublicResumeData["experiences"];
  resumeDownloads?: PublicResumeData["downloads"];
  editor?: boolean;
  locale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
};

export function HomeExperience({ content, activities, skills, experiences, resumeDownloads, editor, locale, onLocaleChange }: HomeExperienceProps) {
  const composedHomepage = activities !== undefined && experiences !== undefined;
  const sectionIds = ["identity", "about", "now", "work", "capability", "journey", "contact"] as const;
  const composition = content.composition;
  const visibleSections = (composition?.sections ?? sectionIds.map((id) => ({ id, visible: true })))
    .filter((section) => section.visible).map((section) => section.id);
  const sections = {
    identity: <Hero visibleSections={visibleSections} />,
    about: <About />,
    now: activities ? <HomeNow activities={selectHomepageRecords(activities, content.homepageSelection?.activities)} /> : null,
    work: <RecentWorks sectionNumber={composedHomepage ? "03" : undefined} />,
    capability: skills ? <HomeCapabilities areas={selectHomepageRecords(skills, content.homepageSelection?.skills)} fallback={content.homepageSelection?.skills === undefined} /> : <Services />,
    journey: experiences ? <HomeJourney experiences={selectHomepageRecords(experiences, content.homepageSelection?.experiences)} resumeDownloads={resumeDownloads ?? { zh: false, en: false }} /> : null,
    contact: <Footer visibleSections={visibleSections} sectionNumber={composedHomepage ? "06" : undefined} />,
  };

  return (
    <I18nProvider content={content} editor={editor} locale={locale} onLocaleChange={onLocaleChange}>
      <div data-homepage-editor={editor ? "true" : undefined} className="min-h-screen overflow-x-hidden bg-ink text-white selection:bg-accent selection:text-ink">
        <Navbar visibleSections={visibleSections} />
        <main>
          {visibleSections.map((id) => id === "contact" && !composition ? null : <Fragment key={id}>{sections[id]}</Fragment>)}
        </main>
        {!composition ? sections.contact : null}
      </div>
    </I18nProvider>
  );
}
