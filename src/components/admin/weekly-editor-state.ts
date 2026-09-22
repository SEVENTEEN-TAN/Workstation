import type { WeeklyActivityDraftData, WeeklyDraftCopy } from "../../lib/services/weekly-activity-drafts";

const limits = { titleZh: 120, titleEn: 120, summaryZh: 4_000, summaryEn: 4_000 } as const;

export function copyFromWeeklyDraft(draft: Pick<WeeklyActivityDraftData, keyof WeeklyDraftCopy>): WeeklyDraftCopy {
  return {
    titleZh: draft.titleZh,
    titleEn: draft.titleEn,
    summaryZh: draft.summaryZh,
    summaryEn: draft.summaryEn,
  };
}

export function sameWeeklyDraftCopy(left: WeeklyDraftCopy, right: WeeklyDraftCopy) {
  return Object.keys(limits).every((key) => left[key as keyof WeeklyDraftCopy] === right[key as keyof WeeklyDraftCopy]);
}

export function weeklyDraftRecoveryKey(id: string) {
  return `weekly-draft-recovery:${id}`;
}

export function parseWeeklyDraftRecovery(value: string | null): WeeklyDraftCopy | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const copy = {
      titleZh: parsed.titleZh,
      titleEn: parsed.titleEn,
      summaryZh: parsed.summaryZh,
      summaryEn: parsed.summaryEn,
    };
    for (const [key, maximum] of Object.entries(limits)) {
      const field = copy[key as keyof typeof copy];
      if (typeof field !== "string" || field.length > maximum) return null;
    }
    const result = copy as WeeklyDraftCopy;
    return result;
  } catch {
    return null;
  }
}
