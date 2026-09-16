"use client";

import { ArrowUpRight, Mail } from "lucide-react";

import type { PublicResumeData } from "../../lib/services/public-resume";
import { I18nProvider, type Locale, useI18n } from "./i18n";
import { ResumeToolbar } from "./ResumeToolbar";
import styles from "../../app/resume/resume.module.css";

const EMAIL = "m13145215766@163.com";
const GITHUB = "https://github.com/SEVENTEEN-TAN";

const labels = {
  zh: { contact: "联系", experience: "经历", projects: "项目", capabilities: "能力", activities: "最新动态", present: "至今", source: "查看" },
  en: { contact: "Contact", experience: "Experience", projects: "Projects", capabilities: "Capabilities", activities: "Recent activity", present: "Present", source: "Open" },
} as const;

function localize(locale: Locale, zh: string, en: string | null | undefined) {
  return locale === "zh" ? zh : (en || zh);
}

function formatMonth(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function ResumeDocument({ data }: { data: PublicResumeData }) {
  const { locale } = useI18n();
  const copy = data.content[locale];
  const text = labels[locale];
  const name = copy.meta.title.split(/\s+[—|-]\s+/)[0] || "SEVENTEEN";

  return (
    <div className={styles.pageFrame}>
      <ResumeToolbar downloads={data.downloads} />
      <main className={styles.resumeDocument}>
        <header className={styles.identity}>
          <p className={styles.kicker}>SEVENTEEN / PERSONAL WORKSTATION</p>
          <h1>{name}</h1>
          <p className={styles.role}>{copy.hero.role}</p>
          <p className={styles.summary}>{copy.hero.intro}</p>
          {copy.about.paragraphs.map((paragraph) => <p className={styles.about} key={paragraph}>{paragraph}</p>)}
        </header>

        <section className={styles.section}>
          <h2>{text.contact}</h2>
          <div className={styles.contactGrid}>
            <a href={`mailto:${EMAIL}`}><Mail aria-hidden="true" />{EMAIL}</a>
            <a href={GITHUB} target="_blank" rel="noreferrer">GitHub<ArrowUpRight aria-hidden="true" /></a>
          </div>
        </section>

        {data.experiences.length ? (
          <section className={styles.section}>
            <h2>{text.experience}</h2>
            <div className={styles.list}>
              {data.experiences.map((item) => (
                <article className={styles.resumeEntry} key={item.id}>
                  <div className={styles.entryHeading}>
                    <div><h3>{localize(locale, item.organizationZh, item.organizationEn)}</h3><p>{localize(locale, item.titleZh, item.titleEn)}</p></div>
                    <time>{formatMonth(locale, item.startedAt)} - {item.isCurrent ? text.present : item.endedAt ? formatMonth(locale, item.endedAt) : text.present}</time>
                  </div>
                  <p>{localize(locale, item.descriptionZh, item.descriptionEn)}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {data.projects.length ? (
          <section className={styles.section}>
            <h2>{text.projects}</h2>
            <div className={styles.list}>
              {data.projects.map((project) => (
                <article className={styles.resumeEntry} key={project.id}>
                  <div className={styles.entryHeading}><h3>{localize(locale, project.titleZh, project.titleEn)}</h3>{project.completedAt || project.startedAt ? <time>{formatMonth(locale, project.completedAt || project.startedAt!)}</time> : null}</div>
                  <p>{localize(locale, project.summaryZh, project.summaryEn)}</p>
                  {project.technologies.length ? <ul className={styles.tagList}>{project.technologies.map((technology) => <li key={technology}>{technology}</li>)}</ul> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {data.skills.length ? (
          <section className={styles.section}>
            <h2>{text.capabilities}</h2>
            <div className={styles.capabilityGrid}>
              {data.skills.map((area) => (
                <article className={styles.resumeEntry} key={area.id}>
                  <h3>{localize(locale, area.nameZh, area.nameEn)}</h3>
                  <p>{localize(locale, area.descriptionZh, area.descriptionEn)}</p>
                  <ul className={styles.skillList}>{area.skills.map((skill) => <li key={skill.id}><strong>{localize(locale, skill.nameZh, skill.nameEn)}</strong><span>{localize(locale, skill.summaryZh, skill.summaryEn)}</span></li>)}</ul>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {data.activities.length ? (
          <section className={styles.section}>
            <h2>{text.activities}</h2>
            <div className={styles.list}>
              {data.activities.map((activity) => (
                <article className={styles.resumeEntry} key={activity.id}>
                  <div className={styles.entryHeading}><h3>{localize(locale, activity.titleZh, activity.titleEn)}</h3><time>{formatMonth(locale, activity.occurredAt)}</time></div>
                  <p>{localize(locale, activity.summaryZh, activity.summaryEn)}</p>
                  {activity.linkUrl ? <a className={styles.entryLink} href={activity.linkUrl} target="_blank" rel="noreferrer">{text.source}<ArrowUpRight aria-hidden="true" /></a> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export function PrintableResume({ data, initialLocale = "en" }: { data: PublicResumeData; initialLocale?: Locale }) {
  return <I18nProvider content={data.content} initialLocale={initialLocale}><ResumeDocument data={data} /></I18nProvider>;
}
