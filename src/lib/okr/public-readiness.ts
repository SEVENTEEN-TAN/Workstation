type Cycle = { visibility: string; nameEn?: string | null };
type KeyResult = {
  titleZh: string;
  titleEn?: string | null;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
};
type Objective = Omit<KeyResult, "titleZh"> & { visibility: string; keyResults: KeyResult[] };
type Review = {
  visibility: string;
  achievementsEn?: string | null;
  problemsEn?: string | null;
  lessonsEn?: string | null;
  nextActionsEn?: string | null;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function descriptionIssues(value: { descriptionZh?: string | null; descriptionEn?: string | null }) {
  if (hasText(value.descriptionZh) === hasText(value.descriptionEn)) return [];
  return [hasText(value.descriptionZh) ? "缺少英文说明" : "缺少中文说明"];
}

export function getCyclePublicIssues(cycle: Cycle): string[] {
  return [
    ...(cycle.visibility !== "PUBLIC" ? ["当前设为私密"] : []),
    ...(!hasText(cycle.nameEn) ? ["缺少周期英文名称"] : []),
  ];
}

export function getKeyResultPublicIssues(keyResult: KeyResult): string[] {
  return [
    ...(!hasText(keyResult.titleEn) ? ["缺少英文标题"] : []),
    ...descriptionIssues(keyResult),
  ];
}

export function getObjectivePublicIssues(objective: Objective, cycle: Cycle): string[] {
  return [
    ...getCyclePublicIssues(cycle).map((issue) => `所属周期：${issue}`),
    ...(objective.visibility !== "PUBLIC" ? ["当前目标设为私密"] : []),
    ...(!hasText(objective.titleEn) ? ["缺少目标英文标题"] : []),
    ...descriptionIssues(objective).map((issue) => `目标${issue}`),
    ...objective.keyResults.flatMap((keyResult) => getKeyResultPublicIssues(keyResult)
      .map((issue) => `KR「${keyResult.titleZh}」：${issue}`)),
  ];
}

export function getReviewPublicIssues(review: Review, cycle: Cycle): string[] {
  return [
    ...getCyclePublicIssues(cycle).map((issue) => `所属周期：${issue}`),
    ...(review.visibility !== "PUBLIC" ? ["当前复盘设为私密"] : []),
    ...(!hasText(review.achievementsEn) ? ["缺少英文成果"] : []),
    ...(!hasText(review.problemsEn) ? ["缺少英文问题"] : []),
    ...(!hasText(review.lessonsEn) ? ["缺少英文经验"] : []),
    ...(!hasText(review.nextActionsEn) ? ["缺少英文下一步"] : []),
  ];
}
