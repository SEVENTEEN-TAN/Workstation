import { z } from "zod";

const optionalLocalizedText = z.string().trim().max(10_000).nullable().optional();
const requiredText = z.string().trim().min(1).max(500);
const id = z.string().trim().min(1);
const date = z.coerce.date();

export const cycleInputSchema = z.object({
  nameZh: requiredText,
  nameEn: optionalLocalizedText,
  type: z.enum(["QUARTER", "YEAR", "CUSTOM"]),
  startDate: date,
  endDate: date,
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).default("DRAFT"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
}).refine((value) => value.endDate >= value.startDate, { message: "结束日期不能早于开始日期", path: ["endDate"] });

export const objectiveInputSchema = z.object({
  cycleId: id,
  titleZh: requiredText,
  titleEn: optionalLocalizedText,
  descriptionZh: optionalLocalizedText,
  descriptionEn: optionalLocalizedText,
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "AT_RISK", "COMPLETED", "CANCELLED"]).default("NOT_STARTED"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  startDate: date.nullable().optional(),
  endDate: date.nullable().optional(),
}).refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, { message: "结束日期不能早于开始日期", path: ["endDate"] });

export const keyResultInputSchema = z.object({
  objectiveId: id,
  titleZh: requiredText,
  titleEn: optionalLocalizedText,
  descriptionZh: optionalLocalizedText,
  descriptionEn: optionalLocalizedText,
  progressMode: z.enum(["METRIC", "MANUAL"]),
  startValue: z.coerce.number().nullable().optional(),
  currentValue: z.coerce.number().nullable().optional(),
  targetValue: z.coerce.number().nullable().optional(),
  manualProgress: z.coerce.number().min(0).max(100).nullable().optional(),
  unit: z.string().trim().max(50).nullable().optional(),
  weight: z.coerce.number().positive().default(1),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "AT_RISK", "COMPLETED", "CANCELLED"]).default("NOT_STARTED"),
  sortOrder: z.coerce.number().int().min(0).default(0),
}).superRefine((value, context) => {
  if (value.progressMode === "METRIC" && [value.startValue, value.currentValue, value.targetValue].some((entry) => entry == null)) {
    context.addIssue({ code: "custom", message: "数值型 KR 必须填写起始值、当前值和目标值", path: ["targetValue"] });
  }
  if (value.progressMode === "MANUAL" && value.manualProgress == null) {
    context.addIssue({ code: "custom", message: "手动型 KR 必须填写进度", path: ["manualProgress"] });
  }
});

export const progressInputSchema = z.object({
  currentValue: z.coerce.number().nullable().optional(),
  manualProgress: z.coerce.number().min(0).max(100).nullable().optional(),
  noteZh: optionalLocalizedText,
  noteEn: optionalLocalizedText,
});

export const reviewInputSchema = z.object({
  cycleId: id,
  objectiveId: id.nullable().optional(),
  achievementsZh: requiredText,
  achievementsEn: optionalLocalizedText,
  problemsZh: requiredText,
  problemsEn: optionalLocalizedText,
  lessonsZh: requiredText,
  lessonsEn: optionalLocalizedText,
  nextActionsZh: requiredText,
  nextActionsEn: optionalLocalizedText,
  score: z.coerce.number().min(0).max(10).nullable().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
  reviewedAt: date.default(() => new Date()),
});

export const entityIdSchema = z.object({ id });
