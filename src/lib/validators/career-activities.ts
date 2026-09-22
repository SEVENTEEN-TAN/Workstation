import { z } from "zod";

const optionalText = (maximum: number, message?: string) => z.string().trim().max(maximum, message).nullable().optional()
  .transform((value) => value === "" ? null : value);

const careerActivityFields = z.object({
  titleZh: z.string().trim().min(1, "中文标题不能为空").max(120, "中文标题不能超过 120 字"),
  titleEn: optionalText(120, "英文标题不能超过 120 字"),
  summaryZh: z.string().trim().min(1, "中文摘要不能为空").max(1_000, "中文摘要不能超过 1000 字"),
  summaryEn: optionalText(1_000, "英文摘要不能超过 1000 字"),
  occurredAt: z.coerce.date(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  featured: z.boolean(),
  linkUrl: optionalText(2_048).refine((value) => value == null || URL.canParse(value), "链接地址格式不正确"),
});

function requirePublicTranslations(
  value: { visibility?: string; titleEn?: string | null; summaryEn?: string | null },
  context: z.RefinementCtx,
) {
  if (value.visibility !== "PUBLIC") return;
  if (!value.titleEn) context.addIssue({ code: "custom", path: ["titleEn"], message: "公开动态需要英文标题" });
  if (!value.summaryEn) context.addIssue({ code: "custom", path: ["summaryEn"], message: "公开动态需要英文摘要" });
}

export const careerActivityInputSchema = careerActivityFields.extend({
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  featured: z.boolean().default(false),
})
  .superRefine(requirePublicTranslations)
  .transform((value) => ({
    ...value,
    titleEn: value.titleEn ?? null,
    summaryEn: value.summaryEn ?? null,
    linkUrl: value.linkUrl ?? null,
  }));

export const careerActivityPatchSchema = careerActivityFields.partial();
