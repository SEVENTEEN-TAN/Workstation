import { z } from "zod";

export const DEFAULT_HOMEPAGE_SETTINGS = {
  portraitImage: "/images/zedian-portrait-v3.png",
  wechatQrImage: "/images/wechat-qr.png",
  email: "m13145215766@163.com",
  githubUrl: "https://github.com/SEVENTEEN-TAN",
} as const;

export const homepageImagePathSchema = z.string().regex(
  /^\/(?:images\/[^?#]+|api\/assets\/[^/?#]+)$/,
  "图片必须使用本地静态路径或媒体库资源",
);

export const homepageEmailSchema = z.string().trim().min(1).max(10_000).email();
export const homepageGithubUrlSchema = z.string().trim().min(1).max(10_000).url().refine(
  (value) => URL.canParse(value) && new URL(value).protocol === "https:",
  "GitHub 地址必须使用 HTTPS",
);

const editingText = z.string().max(10_000);
const savedText = z.string().trim().min(1).max(10_000);

const editingSettingsSchema = z.object({
  portraitImage: homepageImagePathSchema,
  wechatQrImage: homepageImagePathSchema,
  email: editingText,
  githubUrl: editingText,
}).default(DEFAULT_HOMEPAGE_SETTINGS);

const savedSettingsSchema = z.object({
  portraitImage: homepageImagePathSchema,
  wechatQrImage: homepageImagePathSchema,
  email: homepageEmailSchema,
  githubUrl: homepageGithubUrlSchema,
}).default(DEFAULT_HOMEPAGE_SETTINGS);

function buildLocalizedSiteContentSchema(textField: z.ZodString) {
  const textList = z.array(textField).min(1);
  const heading = z.tuple([textField, textField]);

  return z.object({
    meta: z.object({ title: textField, description: textField }),
    nav: z.object({
      brand: textField,
      about: textField,
      work: textField,
      contact: textField,
      top: textField,
      goContact: textField,
      switchLanguage: textField,
      switchLabel: textField,
    }),
    hero: z.object({
      backdrop: textField,
      role: textField,
      lineOne: textField,
      lineTwo: textField,
      headingLabel: textField,
      intro: textField,
      work: textField,
      contact: textField,
      badgeArea: textField,
      badgeLabel: textField,
      portraitAlt: textField,
      badgeRole: textField,
      active: textField,
    }),
    about: z.object({
      eyebrow: textField,
      heading,
      headingLabel: textField,
      paragraphs: textList,
      stats: z.array(z.object({ value: textField, accent: textField, label: textField })).min(1),
      toolkit: textField,
      skillCount: textField,
      skills: textList,
      quote: textField,
    }),
    works: z.object({
      eyebrow: textField,
      heading: textField,
      viewAll: textField,
      explore: textField,
      navigation: textField,
      project: textField,
      showProject: textField,
    }),
    services: z.object({
      eyebrow: textField,
      headingStart: textField,
      headingOutline: textField,
      headingLabel: textField,
      items: z.array(z.tuple([textField, textField])).min(1),
    }),
    footer: z.object({
      backdrop: textField,
      eyebrow: textField,
      heading,
      headingLabel: textField,
      intro: textField,
      menu: textField,
      socials: textField,
      links: textList,
      github: textField,
      wechat: textField,
      wechatHint: textField,
      wechatAlt: textField,
      copyright: textField,
      privacy: textField,
      terms: textField,
    }),
    projects: z.array(z.object({
      slug: textField.optional(),
      image: z.string(),
      category: textField,
      title: textField,
      description: textField,
      tags: textList,
      alt: textField,
    })),
  });
}

function buildSiteContentSchema<
  TLocalized extends z.ZodType,
  TSettings extends z.ZodType,
>(
  localized: TLocalized,
  settingsSchema: TSettings,
) {
  return z.object({
    selectedProjectIds: z.array(savedText)
      .refine((ids) => new Set(ids).size === ids.length, "主页项目不能重复")
      .optional(),
    settings: settingsSchema,
    en: localized,
    zh: localized,
  });
}

const localizedSiteContentEditingSchema = buildLocalizedSiteContentSchema(editingText);
export const localizedSiteContentSchema = buildLocalizedSiteContentSchema(savedText);
export const siteContentEditingSchema = buildSiteContentSchema(
  localizedSiteContentEditingSchema,
  editingSettingsSchema,
);
export const siteContentSchema = buildSiteContentSchema(
  localizedSiteContentSchema,
  savedSettingsSchema,
);

export type LocalizedSiteContent = z.infer<typeof localizedSiteContentSchema>;
export type SiteContent = z.infer<typeof siteContentSchema>;
