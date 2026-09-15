import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional()
  .transform((value) => value === undefined ? undefined : value || null);
const requiredText = (label: string, maximum: number) => z.string().trim().min(1, `${label}不能为空`).max(maximum);
const url = z.string().trim().refine((value) => {
  if (!URL.canParse(value)) return false;
  return ["http:", "https:"].includes(new URL(value).protocol);
}, "链接地址仅支持 HTTP 或 HTTPS")
  .transform((value) => new URL(value).toString());

const projectEvidence = z.object({
  kind: z.literal("PROJECT"),
  projectId: z.string().trim().min(1, "请选择项目证据"),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const articleEvidence = z.object({
  kind: z.literal("ARTICLE"),
  titleZh: requiredText("中文文章标题", 160),
  titleEn: optionalText(160),
  url,
  sortOrder: z.coerce.number().int().min(0).default(0),
});

const evidenceSchema = z.discriminatedUnion("kind", [projectEvidence, articleEvidence]);

const skillFields = z.object({
  nameZh: requiredText("中文技能名称", 120),
  nameEn: optionalText(120),
  summaryZh: requiredText("中文技能说明", 800),
  summaryEn: optionalText(800),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  sortOrder: z.coerce.number().int().min(0).default(0),
  evidence: z.array(evidenceSchema).max(12),
});

const fields = z.object({
  nameZh: requiredText("中文能力域名称", 120),
  nameEn: optionalText(120),
  descriptionZh: requiredText("中文能力域说明", 1200),
  descriptionEn: optionalText(1200),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  sortOrder: z.coerce.number().int().min(0),
  skills: z.array(skillFields).max(24),
});

export const skillAreaInputSchema = fields.extend({
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  skills: fields.shape.skills.default([]),
}).superRefine((value, context) => {
  if (value.visibility !== "PUBLIC") return;
  if (!value.nameEn) context.addIssue({ code: "custom", path: ["nameEn"], message: "公开能力域需要英文名称" });
  if (!value.descriptionEn) context.addIssue({ code: "custom", path: ["descriptionEn"], message: "公开能力域需要英文说明" });
  value.skills.forEach((skill, skillIndex) => {
    if (skill.visibility !== "PUBLIC") return;
    if (!skill.nameEn) context.addIssue({ code: "custom", path: ["skills", skillIndex, "nameEn"], message: "公开技能需要英文名称" });
    if (!skill.summaryEn) context.addIssue({ code: "custom", path: ["skills", skillIndex, "summaryEn"], message: "公开技能需要英文说明" });
    if (!skill.evidence.length) context.addIssue({ code: "custom", path: ["skills", skillIndex, "evidence"], message: "公开技能至少需要一项证据" });
    skill.evidence.forEach((item, evidenceIndex) => {
      if (item.kind === "ARTICLE" && !item.titleEn) {
        context.addIssue({ code: "custom", path: ["skills", skillIndex, "evidence", evidenceIndex, "titleEn"], message: "公开文章证据需要英文标题" });
      }
    });
  });
}).transform((value) => ({
  ...value,
  nameEn: value.nameEn ?? null,
  descriptionEn: value.descriptionEn ?? null,
  skills: value.skills.map((skill) => ({
    ...skill,
    nameEn: skill.nameEn ?? null,
    summaryEn: skill.summaryEn ?? null,
    evidence: skill.evidence.map((item) => item.kind === "ARTICLE"
      ? { ...item, titleEn: item.titleEn ?? null }
      : item),
  })),
}));

export const skillAreaPatchSchema = fields.partial();

export type SkillEvidenceInput = z.infer<typeof evidenceSchema>;
export type SkillInput = z.infer<typeof skillAreaInputSchema>["skills"][number];
export type SkillAreaInput = z.infer<typeof skillAreaInputSchema>;
