import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional()
  .transform((value) => value === undefined ? undefined : value || null);

const requiredText = (label: string, maximum = 2_000) => z.string().trim().min(1, `${label}不能为空`).max(maximum);
const optionalDate = z.preprocess(
  (value) => typeof value === "string" && !value.trim() ? null : value,
  z.coerce.date().nullable().optional(),
).transform((value) => value === undefined ? undefined : value);

const projectLinkSchema = z.object({
  kind: z.enum(["WEBSITE", "SOURCE", "DEMO", "ARTICLE"]),
  labelZh: requiredText("中文链接名称", 80),
  labelEn: optionalText(80),
  url: z.string().trim().refine(URL.canParse, "链接地址格式不正确").transform((value) => new URL(value).toString()),
});

const fields = z.object({
  slug: z.string().trim().min(1).max(100)
    .transform((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .refine((value) => value.length > 0, "Slug 只能包含英文、数字和连字符"),
  titleZh: requiredText("中文标题", 120),
  titleEn: optionalText(120),
  summaryZh: requiredText("中文摘要", 600),
  summaryEn: optionalText(600),
  contextZh: requiredText("中文项目背景"),
  contextEn: optionalText(2_000),
  responsibilityZh: requiredText("中文职责"),
  responsibilityEn: optionalText(2_000),
  challengeZh: requiredText("中文挑战"),
  challengeEn: optionalText(2_000),
  approachZh: requiredText("中文方案"),
  approachEn: optionalText(2_000),
  resultZh: requiredText("中文结果"),
  resultEn: optionalText(2_000),
  coverImage: optionalText(2_048).refine((value) => value == null || value.startsWith("/") || URL.canParse(value), "封面地址格式不正确"),
  coverAltZh: optionalText(240),
  coverAltEn: optionalText(240),
  technologies: z.array(z.string().trim().min(1).max(60)).min(1, "至少填写一项技术").max(24)
    .transform((items) => [...new Set(items)]),
  links: z.array(projectLinkSchema).max(8),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  featured: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
  startedAt: optionalDate,
  completedAt: optionalDate,
});

function validateProject(value: z.infer<typeof fields>, context: z.RefinementCtx) {
  if (value.coverImage && !value.coverAltZh) {
    context.addIssue({ code: "custom", path: ["coverAltZh"], message: "封面需要中文替代文本" });
  }
  if (value.completedAt && value.startedAt && value.completedAt < value.startedAt) {
    context.addIssue({ code: "custom", path: ["completedAt"], message: "完成日期不能早于开始日期" });
  }
  if (value.visibility !== "PUBLIC") return;

  const translatedFields = ["titleEn", "summaryEn", "contextEn", "responsibilityEn", "challengeEn", "approachEn", "resultEn"] as const;
  for (const field of translatedFields) {
    if (!value[field]) context.addIssue({ code: "custom", path: [field], message: "公开项目需要完整英文内容" });
  }
  if (value.coverImage && !value.coverAltEn) {
    context.addIssue({ code: "custom", path: ["coverAltEn"], message: "公开项目需要英文封面替代文本" });
  }
  value.links.forEach((link, index) => {
    if (!link.labelEn) context.addIssue({ code: "custom", path: ["links", index, "labelEn"], message: "公开项目链接需要英文名称" });
  });
}

export const portfolioProjectInputSchema = fields.extend({
  links: z.array(projectLinkSchema).max(8).default([]),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
}).superRefine(validateProject).transform((value) => ({
  ...value,
  titleEn: value.titleEn ?? null,
  summaryEn: value.summaryEn ?? null,
  contextEn: value.contextEn ?? null,
  responsibilityEn: value.responsibilityEn ?? null,
  challengeEn: value.challengeEn ?? null,
  approachEn: value.approachEn ?? null,
  resultEn: value.resultEn ?? null,
  coverImage: value.coverImage ?? null,
  coverAltZh: value.coverAltZh ?? null,
  coverAltEn: value.coverAltEn ?? null,
  startedAt: value.startedAt ?? null,
  completedAt: value.completedAt ?? null,
}));

export const portfolioProjectPatchSchema = fields.partial();

export type PortfolioProjectInput = z.infer<typeof portfolioProjectInputSchema>;
export type PortfolioProjectLink = z.infer<typeof projectLinkSchema>;
