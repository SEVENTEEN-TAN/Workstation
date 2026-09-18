import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD");

export const weeklyRangeSchema = z.object({
  weekStart: dateOnly,
  weekEnd: dateOnly,
});

export const weeklyDraftPatchSchema = z.object({
  titleZh: z.string().trim().min(1, "中文标题不能为空").max(120),
  titleEn: z.string().trim().max(120),
  summaryZh: z.string().trim().min(1, "中文摘要不能为空").max(4_000),
  summaryEn: z.string().trim().max(4_000),
});
