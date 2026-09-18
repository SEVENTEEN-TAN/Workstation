import { z } from "zod";

export const careerTimelineDraftPatchSchema = z.object({
  titleZh: z.string().trim().min(1, "中文标题不能为空").max(120),
  titleEn: z.string().trim().max(120),
  summaryZh: z.string().trim().min(1, "中文摘要不能为空").max(4_000),
  summaryEn: z.string().trim().max(4_000),
});
