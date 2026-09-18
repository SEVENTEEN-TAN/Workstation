import { z } from "zod";

const required = z.string().trim().min(1).max(4000);
const optional = (max = 4000) => z.string().trim().max(max).default("");

export const projectDescriptionDraftSchema = z.object({
  summaryZh: required.max(600),
  summaryEn: optional(600),
  contextZh: required,
  contextEn: optional(),
  responsibilityZh: required,
  responsibilityEn: optional(),
  challengeZh: required,
  challengeEn: optional(),
  approachZh: required,
  approachEn: optional(),
  resultZh: required,
  resultEn: optional(),
});

export const weeklyUpdateDraftSchema = z.object({
  titleZh: required.max(120),
  titleEn: optional(120),
  summaryZh: required,
  summaryEn: optional(),
});

export const okrReviewDraftSchema = z.object({
  achievementsZh: required,
  achievementsEn: optional(),
  problemsZh: required,
  problemsEn: optional(),
  lessonsZh: required,
  lessonsEn: optional(),
  nextActionsZh: required,
  nextActionsEn: optional(),
  score: z.coerce.number().min(0).max(10).nullable().default(null),
});

export type ProjectDescriptionDraft = z.infer<typeof projectDescriptionDraftSchema>;
export type WeeklyUpdateDraft = z.infer<typeof weeklyUpdateDraftSchema>;
export type OkrReviewDraft = z.infer<typeof okrReviewDraftSchema>;
