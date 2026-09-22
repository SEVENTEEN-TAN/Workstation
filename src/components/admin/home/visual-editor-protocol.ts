import { homepageImagePathSchema, siteContentSchema, type SiteContent } from "../../../lib/content/schema";

export type VisualEditKind = "text" | "link" | "image";
export type VisualEditSection = "identity" | "about" | "work" | "capability" | "contact";

export type VisualEditField = {
  path: string;
  kind: VisualEditKind;
  label: string;
  section: VisualEditSection;
  altPaths?: { zh: string; en: string };
};

export type HomepageImagePath = "settings.portraitImage" | "settings.wechatQrImage";

const FIXED_LOCALIZED_FIELDS = [
  ["nav.brand", "导航品牌", "identity"], ["nav.about", "导航关于", "identity"], ["nav.work", "导航作品", "identity"], ["nav.contact", "导航联系", "identity"],
  ["hero.backdrop", "首屏背景字", "identity"], ["hero.role", "首屏职位", "identity"], ["hero.lineOne", "首屏标题第一行", "identity"], ["hero.lineTwo", "首屏标题第二行", "identity"], ["hero.intro", "首屏介绍", "identity"], ["hero.work", "作品按钮", "identity"], ["hero.contact", "联系按钮", "identity"], ["hero.badgeRole", "人物卡职位", "identity"], ["hero.active", "人物卡状态", "identity"],
  ["about.eyebrow", "关于眉题", "about"], ["about.heading.0", "关于标题第一行", "about"], ["about.heading.1", "关于标题第二行", "about"], ["about.toolkit", "工具箱标题", "about"], ["about.skillCount", "技能数量", "about"], ["about.quote", "关于引语", "about"],
  ["works.eyebrow", "作品眉题", "work"], ["works.heading", "作品标题", "work"], ["works.viewAll", "查看全部", "work"], ["works.explore", "浏览项目", "work"],
  ["services.eyebrow", "能力眉题", "capability"], ["services.headingStart", "能力标题", "capability"], ["services.headingOutline", "能力标题强调", "capability"],
  ["footer.backdrop", "联系背景字", "contact"], ["footer.eyebrow", "联系眉题", "contact"], ["footer.heading.0", "联系标题第一行", "contact"], ["footer.heading.1", "联系标题第二行", "contact"], ["footer.intro", "联系介绍", "contact"], ["footer.menu", "菜单标题", "contact"], ["footer.socials", "社交标题", "contact"], ["footer.github", "GitHub 标签", "contact"], ["footer.wechat", "微信标签", "contact"], ["footer.copyright", "版权文字", "contact"], ["footer.privacy", "隐私文字", "contact"], ["footer.terms", "条款文字", "contact"],
] as const satisfies readonly (readonly [string, string, VisualEditSection])[];

function fixedLocalizedFields(locale: "zh" | "en"): VisualEditField[] {
  const prefix = locale.toUpperCase();
  return FIXED_LOCALIZED_FIELDS.map(([path, label, section]) => ({
    path: `${locale}.${path}`,
    kind: "text",
    label: `${prefix} · ${label}`,
    section,
  }));
}

function localizedCollectionFields(content: SiteContent, locale: "zh" | "en"): VisualEditField[] {
  const copy = content[locale];
  const prefix = locale.toUpperCase();
  return [
    ...copy.about.paragraphs.map((_, index) => ({ path: `${locale}.about.paragraphs.${index}`, kind: "text" as const, label: `${prefix} · 关于段落 ${index + 1}`, section: "about" as const })),
    ...copy.about.stats.flatMap((_, index) => (["value", "accent", "label"] as const).map((key) => ({ path: `${locale}.about.stats.${index}.${key}`, kind: "text" as const, label: `${prefix} · 关于数据 ${index + 1} ${key}`, section: "about" as const }))),
    ...copy.about.skills.map((_, index) => ({ path: `${locale}.about.skills.${index}`, kind: "text" as const, label: `${prefix} · 技能 ${index + 1}`, section: "about" as const })),
    ...copy.services.items.flatMap((_, index) => ([0, 1] as const).map((part) => ({ path: `${locale}.services.items.${index}.${part}`, kind: "text" as const, label: `${prefix} · 服务 ${index + 1} ${part === 0 ? "名称" : "说明"}`, section: "capability" as const }))),
    ...copy.footer.links.map((_, index) => ({ path: `${locale}.footer.links.${index}`, kind: "text" as const, label: `${prefix} · 页脚菜单 ${index + 1}`, section: "contact" as const })),
  ];
}

export function getVisualEditFields(content: SiteContent): readonly VisualEditField[] {
  return [
    ...fixedLocalizedFields("zh"),
    ...localizedCollectionFields(content, "zh"),
    ...fixedLocalizedFields("en"),
    ...localizedCollectionFields(content, "en"),
    { path: "settings.email", kind: "link", label: "联系邮箱", section: "contact" },
    { path: "settings.githubUrl", kind: "link", label: "GitHub 地址", section: "contact" },
    { path: "settings.portraitImage", kind: "image", label: "人物肖像", section: "identity", altPaths: { zh: "zh.hero.portraitAlt", en: "en.hero.portraitAlt" } },
    { path: "settings.wechatQrImage", kind: "image", label: "微信二维码", section: "contact", altPaths: { zh: "zh.footer.wechatAlt", en: "en.footer.wechatAlt" } },
  ];
}

export function getVisualEditField(content: SiteContent, path: unknown): VisualEditField | null {
  if (typeof path !== "string") return null;
  return getVisualEditFields(content).find((field) => field.path === path) ?? null;
}

const staticVisualEditFields = [
  ...fixedLocalizedFields("zh"),
  ...fixedLocalizedFields("en"),
  { path: "settings.email", kind: "link" as const, label: "联系邮箱", section: "contact" as const },
  { path: "settings.githubUrl", kind: "link" as const, label: "GitHub 地址", section: "contact" as const },
  { path: "settings.portraitImage", kind: "image" as const, label: "人物肖像", section: "identity" as const },
  { path: "settings.wechatQrImage", kind: "image" as const, label: "微信二维码", section: "contact" as const },
];
const fieldsByPath = new Map(staticVisualEditFields.map((field) => [field.path, field]));

export function isVisualEditField(path: unknown): path is string {
  return typeof path === "string" && fieldsByPath.has(path);
}

function isPlainEditorValue(value: unknown): value is string {
  return typeof value === "string" && value.length <= 10_000 && !/[<>]/.test(value);
}

export type IframeCommitMessage = { type: "homepage-editor:commit"; path: string; value: string };
export type IframeReadyMessage = { type: "homepage-editor:ready" };
export type IframeSelectMessage = { type: "homepage-editor:select"; path: string };
export type IframeMessage = IframeCommitMessage | IframeReadyMessage | IframeSelectMessage;

export function parseIframeMessage(value: unknown): IframeMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as { type?: unknown; path?: unknown; value?: unknown };
  if (message.type === "homepage-editor:ready") return { type: message.type };
  if (message.type === "homepage-editor:select" && isVisualEditField(message.path)) return { type: message.type, path: message.path };
  if (message.type !== "homepage-editor:commit" || !isVisualEditField(message.path) || !isPlainEditorValue(message.value)) return null;
  const field = fieldsByPath.get(message.path)!;
  if (field.kind === "image" && !homepageImagePathSchema.safeParse(message.value).success) return null;
  return { type: message.type, path: message.path, value: message.value };
}

export type ParentContentMessage = { type: "homepage-editor:content"; content: SiteContent };

export function parseParentContentMessage(value: unknown): ParentContentMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as { type?: unknown; content?: unknown };
  const parsed = message.type === "homepage-editor:content" ? siteContentSchema.safeParse(message.content) : null;
  return parsed?.success ? { type: "homepage-editor:content", content: parsed.data } : null;
}
