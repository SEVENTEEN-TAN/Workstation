type Locale = "en" | "zh";

type LegacyProject = {
  image: string;
  en: Record<string, unknown>;
  zh: Record<string, unknown>;
};

type LegacyContent = Record<Locale, Record<string, unknown>>;

export function migrateLegacySiteContent(
  content: LegacyContent,
  projects: LegacyProject[],
) {
  const localizedProjects = (locale: Locale) =>
    projects.map((project) => ({
      image: project.image,
      ...project[locale],
    }));

  return {
    en: { ...content.en, projects: localizedProjects("en") },
    zh: { ...content.zh, projects: localizedProjects("zh") },
  };
}
