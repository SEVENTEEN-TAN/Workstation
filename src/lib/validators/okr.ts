import { z } from "zod";

const optionalLocalizedText = z.string().trim().max(10_000).nullable().optional();
const requiredText = z.string().trim().min(1).max(500);
const id = z.string().trim().min(1);
const date = z.coerce.date();

const cycleBaseSchema = z.object({
  nameZh: requiredText,
  nameEn: optionalLocalizedText,
  type: z.enum(["QUARTER", "YEAR", "CUSTOM"]),
  startDate: date,
  endDate: date,
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).default("DRAFT"),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE"),
});

const validDateRange = (value: { startDate?: Date | null; endDate?: Date | null }) => (
  !value.startDate || !value.endDate || value.endDate >= value.startDate
);

export const cycleInputSchema = cycleBaseSchema.refine(validDateRange, { message: "结束日期不能早于开始日期", path: ["endDate"] });
export const cyclePatchSchema = cycleBaseSchema.partial().extend({
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
}).refine(validDateRange, { message: "结束日期不能早于开始日期", path: ["endDate"] });

const objectiveBaseSchema = z.object({
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
});

export const objectiveInputSchema = objectiveBaseSchema.refine(validDateRange, { message: "结束日期不能早于开始日期", path: ["endDate"] });
export const objectivePatchSchema = objectiveBaseSchema.partial().extend({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "AT_RISK", "COMPLETED", "CANCELLED"]).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).refine(validDateRange, { message: "结束日期不能早于开始日期", path: ["endDate"] });

const keyResultBaseSchema = z.object({
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
});

function validateKeyResultMode(value: Partial<z.infer<typeof keyResultBaseSchema>>, context: z.RefinementCtx) {
  if (value.progressMode === "METRIC" && [value.startValue, value.currentValue, value.targetValue].some((entry) => entry == null)) {
    context.addIssue({ code: "custom", message: "数值型 KR 必须填写起始值、当前值和目标值", path: ["targetValue"] });
  }
  if (value.progressMode === "MANUAL" && value.manualProgress == null) {
    context.addIssue({ code: "custom", message: "手动型 KR 必须填写进度", path: ["manualProgress"] });
  }
}

export const keyResultInputSchema = keyResultBaseSchema.superRefine(validateKeyResultMode);
export const keyResultPatchSchema = keyResultBaseSchema.partial().extend({
  weight: z.coerce.number().positive().optional(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "AT_RISK", "COMPLETED", "CANCELLED"]).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
}).superRefine(validateKeyResultMode);

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
export const reviewPatchSchema = reviewInputSchema.partial().extend({
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  reviewedAt: date.optional(),
});

const recurrenceDaysSchema = z.union([
  z.string(),
  z.array(z.coerce.number().int().min(1).max(7)),
]).nullable().optional().transform((value) => {
  if (value == null || value === "") return null;
  const days = Array.isArray(value)
    ? value
    : value.split(",").map((entry) => Number(entry.trim()));
  if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new Error("星期必须是 1 到 7");
  }
  return [...new Set(days)].sort((left, right) => left - right).join(",");
});

const actionItemBaseSchema = z.object({
  keyResultId: id,
  titleZh: requiredText,
  titleEn: optionalLocalizedText,
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]).default("TODO"),
  dueDate: date.nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  recurrenceType: z.enum(["NONE", "DAILY", "WEEKLY"]).default("NONE"),
  recurrenceInterval: z.coerce.number().int().min(1).max(365).default(1),
  recurrenceDays: recurrenceDaysSchema,
});

export const actionItemInputSchema = actionItemBaseSchema.superRefine((value, context) => {
  if (value.recurrenceType === "WEEKLY" && !value.recurrenceDays) {
    context.addIssue({ code: "custom", message: "每周重复至少选择一天", path: ["recurrenceDays"] });
  }
  if (value.recurrenceType !== "WEEKLY" && value.recurrenceDays) {
    context.addIssue({ code: "custom", message: "仅每周重复可以设置星期", path: ["recurrenceDays"] });
  }
});

export const actionItemPatchSchema = z.object({
  keyResultId: id.optional(),
  titleZh: requiredText.optional(),
  titleEn: optionalLocalizedText,
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]).optional(),
  dueDate: date.nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  recurrenceType: z.enum(["NONE", "DAILY", "WEEKLY"]).optional(),
  recurrenceInterval: z.coerce.number().int().min(1).max(365).optional(),
  recurrenceDays: recurrenceDaysSchema,
});

export const entityIdSchema = z.object({ id });
