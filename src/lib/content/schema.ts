import { z } from "zod";

const text = z.string().trim().min(1);
const textList = z.array(text).min(1);
const heading = z.tuple([text, text]);

const metaSchema = z.object({
  title: text,
  description: text,
});

const navSchema = z.object({
  brand: text,
  about: text,
  work: text,
  contact: text,
  top: text,
  goContact: text,
  switchLanguage: text,
  switchLabel: text,
});

const heroSchema = z.object({
  backdrop: text,
  role: text,
  lineOne: text,
  lineTwo: text,
  headingLabel: text,
  intro: text,
  work: text,
  contact: text,
  badgeArea: text,
  badgeLabel: text,
  portraitAlt: text,
  badgeRole: text,
  active: text,
});

const aboutSchema = z.object({
  eyebrow: text,
  heading,
  headingLabel: text,
  paragraphs: textList,
  stats: z.array(z.object({ value: text, accent: text, label: text })).min(1),
  toolkit: text,
  skillCount: text,
  skills: textList,
  quote: text,
});

const worksSchema = z.object({
  eyebrow: text,
  heading: text,
  viewAll: text,
  explore: text,
  navigation: text,
  project: text,
  showProject: text,
});

const servicesSchema = z.object({
  eyebrow: text,
  headingStart: text,
  headingOutline: text,
  headingLabel: text,
  items: z.array(z.tuple([text, text])).min(1),
});

const footerSchema = z.object({
  backdrop: text,
  eyebrow: text,
  heading,
  headingLabel: text,
  intro: text,
  menu: text,
  socials: text,
  links: textList,
  github: text,
  wechat: text,
  wechatHint: text,
  wechatAlt: text,
  copyright: text,
  privacy: text,
  terms: text,
});

const projectSchema = z.object({
  image: text,
  category: text,
  title: text,
  description: text,
  tags: textList,
  alt: text,
});

export const localizedSiteContentSchema = z.object({
  meta: metaSchema,
  nav: navSchema,
  hero: heroSchema,
  about: aboutSchema,
  works: worksSchema,
  services: servicesSchema,
  footer: footerSchema,
  projects: z.array(projectSchema),
});

export const siteContentSchema = z.object({
  en: localizedSiteContentSchema,
  zh: localizedSiteContentSchema,
});

export type LocalizedSiteContent = z.infer<typeof localizedSiteContentSchema>;
export type SiteContent = z.infer<typeof siteContentSchema>;
