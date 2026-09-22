import { describe, expect, it } from "vitest";

import {
  copyFromWeeklyDraft,
  parseWeeklyDraftRecovery,
  sameWeeklyDraftCopy,
  weeklyDraftRecoveryKey,
} from "../src/components/admin/weekly-editor-state";

const copy = {
  titleZh: "本周进展",
  titleEn: "Weekly progress",
  summaryZh: "完成同步。",
  summaryEn: "Finished sync.",
};
const expectedUpdatedAt = "2026-09-18T03:00:00.000Z";

describe("weekly editor recovery state", () => {
  it("copies only editable fields and uses a draft-specific session key", () => {
    expect(copyFromWeeklyDraft({ ...copy, id: "draft-1", sourceSnapshot: { secret: "not copied" } })).toEqual(copy);
    expect(weeklyDraftRecoveryKey("draft-1")).toBe("weekly-draft-recovery:draft-1");
  });

  it("preserves the original server version in a bounded recovery payload", () => {
    expect(parseWeeklyDraftRecovery(JSON.stringify({ values: copy, expectedUpdatedAt }))).toEqual({ values: copy, expectedUpdatedAt });
    expect(parseWeeklyDraftRecovery(JSON.stringify({ values: { ...copy, titleZh: "", summaryZh: "" }, expectedUpdatedAt }))).toEqual({
      values: { ...copy, titleZh: "", summaryZh: "" },
      expectedUpdatedAt,
    });
    expect(parseWeeklyDraftRecovery(JSON.stringify(copy))).toBeNull();
    expect(parseWeeklyDraftRecovery("not-json")).toBeNull();
    expect(parseWeeklyDraftRecovery(JSON.stringify({ values: copy, expectedUpdatedAt: "not-a-date" }))).toBeNull();
    expect(parseWeeklyDraftRecovery(JSON.stringify({ values: { ...copy, summaryZh: "长".repeat(4001) }, expectedUpdatedAt }))).toBeNull();
    expect(parseWeeklyDraftRecovery(JSON.stringify({ values: { ...copy, titleEn: 42 }, expectedUpdatedAt }))).toBeNull();
  });

  it("compares all four fields so a candidate becomes stale after further editing", () => {
    expect(sameWeeklyDraftCopy(copy, { ...copy })).toBe(true);
    expect(sameWeeklyDraftCopy(copy, { ...copy, summaryZh: "继续编辑" })).toBe(false);
  });
});
