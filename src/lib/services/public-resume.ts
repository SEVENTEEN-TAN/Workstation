import type { SiteContent } from "../content/schema";
import { experienceRecordService, type ExperienceRecord } from "./experience-records";
import { getPublishedSiteContent } from "./public-data";
import { portfolioProjectService, type PortfolioProjectRecord } from "./portfolio-projects";
import { skillCapabilityService, type PublicSkillArea } from "./skill-capabilities";
import { careerActivityService, type CareerActivityRecord } from "./career-activities";
import { getResumeFileService, type ResumeFileRecord } from "./resume-files";

type Serializable<T> = T extends Date
  ? string
  : T extends readonly (infer Item)[]
    ? Serializable<Item>[]
    : T extends object
      ? { [Key in keyof T]: Serializable<T[Key]> }
      : T;

export type PublicResumeData = {
  content: SiteContent;
  experiences: Serializable<ExperienceRecord>[];
  projects: Serializable<PortfolioProjectRecord>[];
  skills: PublicSkillArea[];
  activities: Serializable<CareerActivityRecord>[];
  downloads: { zh: boolean; en: boolean };
};

export type PublicResumeSources = {
  loadSiteContent: () => Promise<SiteContent | null>;
  loadExperiences: () => Promise<ExperienceRecord[]>;
  loadProjects: () => Promise<PortfolioProjectRecord[]>;
  loadSkills: () => Promise<PublicSkillArea[]>;
  loadActivities: () => Promise<CareerActivityRecord[]>;
  loadResumeFiles: () => Promise<Array<Pick<ResumeFileRecord, "locale" | "visibility">>>;
};

function serialize<T>(value: T): Serializable<T> {
  if (value instanceof Date) return value.toISOString() as Serializable<T>;
  if (Array.isArray(value)) return value.map(serialize) as Serializable<T>;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serialize(item)]),
    ) as Serializable<T>;
  }
  return value as Serializable<T>;
}

export function createPublicResumeService(sources: PublicResumeSources) {
  return {
    async getData(): Promise<PublicResumeData | null> {
      const content = await sources.loadSiteContent();
      if (!content) return null;

      const [experiences, projects, skills, activities, resumeFiles] = await Promise.all([
        sources.loadExperiences(),
        sources.loadProjects(),
        sources.loadSkills(),
        sources.loadActivities(),
        sources.loadResumeFiles(),
      ]);

      return {
        content,
        experiences: serialize(experiences),
        projects: serialize(projects),
        skills,
        activities: serialize(activities),
        downloads: {
          zh: resumeFiles.some((file) => file.locale === "ZH" && file.visibility === "PUBLIC"),
          en: resumeFiles.some((file) => file.locale === "EN" && file.visibility === "PUBLIC"),
        },
      };
    },
  };
}

export async function getPublicResumeData() {
  const resumeFiles = await getResumeFileService();
  return createPublicResumeService({
    loadSiteContent: getPublishedSiteContent,
    loadExperiences: () => experienceRecordService.listPublic(),
    loadProjects: () => portfolioProjectService.listPublic(),
    loadSkills: () => skillCapabilityService.listPublic(),
    loadActivities: () => careerActivityService.listPublic(),
    loadResumeFiles: () => resumeFiles.list(),
  }).getData();
}
