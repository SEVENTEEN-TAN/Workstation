import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional()
  .transform((value) => value === undefined ? undefined : value || null);

const requiredText = (label: string, maximum = 2_000) => z.string().trim().min(1, `${label}不能为空`).max(maximum);
const optionalDate = z.preprocess(
  (value) => typeof value === "string" && !value.trim() ? null : value,
  z.coerce.date().nullable().optional(),
).transform((value) => value === undefined ? undefined : value);

const fields = z.object({
  kind: z.enum(["WORK", "EDUCATION"]),
  organizationZh: requiredText("中文机构名称", 160),
  organizationEn: optionalText(160),
  titleZh: requiredText("中文职位或专业", 160),
  titleEn: optionalText(160),
  descriptionZh: requiredText("中文经历描述"),
  descriptionEn: optionalText(2_000),
  locationZh: optionalText(120),
  locationEn: optionalText(120),
  linkUrl: optionalText(2_048).refine((value) => value == null || URL.canParse(value), "链接地址格式不正确"),
  startedAt: z.coerce.date(),
  endedAt: optionalDate,
  isCurrent: z.boolean(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  featured: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
});

function validateExperience(
  value: z.infer<typeof fields>,
  context: z.RefinementCtx,
) {
  if (value.isCurrent && value.endedAt) {
    context.addIssue({
      code: "custom",
      path: ["endedAt"],
      message: "当前经历不能填写结束日期",
    });
  }
  if (value.endedAt && value.endedAt < value.startedAt) {
    context.addIssue({
      code: "custom",
      path: ["endedAt"],
      message: "结束日期不能早于开始日期",
    });
  }
  if (value.visibility !== "PUBLIC") return;

  const publicFields = [
    ["organizationEn", "公开经历需要英文机构名称"],
    ["titleEn", "公开经历需要英文职位或专业"],
    ["descriptionEn", "公开经历需要英文描述"],
  ] as const;
  for (const [field, message] of publicFields) {
    if (!value[field]) context.addIssue({ code: "custom", path: [field], message });
  }
  if (value.locationZh && !value.locationEn) {
    context.addIssue({ code: "custom", path: ["locationEn"], message: "公开经历需要英文地点" });
  }
}

export const experienceRecordInputSchema = fields.extend({
  isCurrent: z.boolean().default(false),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
}).superRefine(validateExperience).transform((value) => ({
  ...value,
  organizationEn: value.organizationEn ?? null,
  titleEn: value.titleEn ?? null,
  descriptionEn: value.descriptionEn ?? null,
  locationZh: value.locationZh ?? null,
  locationEn: value.locationEn ?? null,
  linkUrl: value.linkUrl ?? null,
  endedAt: value.endedAt ?? null,
}));

export const experienceRecordPatchSchema = fields.partial();

export type ExperienceRecordInput = z.infer<typeof experienceRecordInputSchema>;
