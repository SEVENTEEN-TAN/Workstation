import { homepageImagePathSchema, siteContentSchema, type SiteContent } from "../../../lib/content/schema";

export type VisualEditKind = "text" | "link" | "image";

export type VisualEditField = {
  path: string;
  kind: VisualEditKind;
  label: string;
};

const localizedTextFields = [
  ["nav.brand", "导航品牌"], ["nav.about", "导航关于"], ["nav.work", "导航作品"], ["nav.contact", "导航联系"],
  ["hero.backdrop", "首屏背景字"], ["hero.role", "首屏职位"], ["hero.lineOne", "首屏标题第一行"], ["hero.lineTwo", "首屏标题第二行"], ["hero.intro", "首屏介绍"], ["hero.work", "作品按钮"], ["hero.contact", "联系按钮"], ["hero.portraitAlt", "肖像替代文本"],
  ["about.eyebrow", "关于眉题"], ["about.heading.0", "关于标题第一行"], ["about.heading.1", "关于标题第二行"], ["about.paragraphs.0", "关于第一段"], ["about.paragraphs.1", "关于第二段"], ["about.toolkit", "工具箱标题"], ["about.skillCount", "技能数量"], ["about.quote", "关于引语"],
  ["works.eyebrow", "作品眉题"], ["works.heading", "作品标题"], ["works.viewAll", "查看全部"], ["works.explore", "浏览项目"],
  ["services.eyebrow", "能力眉题"], ["services.headingStart", "能力标题"], ["services.headingOutline", "能力标题强调"],
  ["footer.eyebrow", "联系眉题"], ["footer.heading.0", "联系标题第一行"], ["footer.heading.1", "联系标题第二行"], ["footer.intro", "联系介绍"], ["footer.menu", "菜单标题"], ["footer.socials", "社交标题"], ["footer.github", "GitHub 标签"], ["footer.wechat", "微信标签"], ["footer.wechatAlt", "二维码替代文本"],
] as const;

export const VISUAL_EDIT_FIELDS: readonly VisualEditField[] = [
  ...(["zh", "en"] as const).flatMap((locale) => localizedTextFields.map(([path, label]) => ({ path: `${locale}.${path}`, kind: "text" as const, label: `${locale.toUpperCase()} · ${label}` }))),
  { path: "settings.email", kind: "link", label: "联系邮箱" },
  { path: "settings.githubUrl", kind: "link", label: "GitHub 地址" },
  { path: "settings.portraitImage", kind: "image", label: "人物肖像" },
  { path: "settings.wechatQrImage", kind: "image", label: "微信二维码" },
];

const fieldsByPath = new Map(VISUAL_EDIT_FIELDS.map((field) => [field.path, field]));

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
