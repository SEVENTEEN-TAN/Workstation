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

describe("weekly editor recovery state", () => {
  it("copies only editable fields and uses a draft-specific session key", () => {
    expect(copyFromWeeklyDraft({ ...copy, id: "draft-1", sourceSnapshot: { secret: "not copied" } })).toEqual(copy);
    expect(weeklyDraftRecoveryKey("draft-1")).toBe("weekly-draft-recovery:draft-1");
  });

  it("accepts a bounded recovery copy and rejects malformed or oversized browser data", () => {
    expect(parseWeeklyDraftRecovery(JSON.stringify(copy))).toEqual(copy);
    expect(parseWeeklyDraftRecovery(JSON.stringify({ ...copy, titleZh: "", summaryZh: "" }))).toEqual({ ...copy, titleZh: "", summaryZh: "" });
    expect(parseWeeklyDraftRecovery("not-json")).toBeNull();
    expect(parseWeeklyDraftRecovery(JSON.stringify({ ...copy, summaryZh: "长".repeat(4001) }))).toBeNull();
    expect(parseWeeklyDraftRecovery(JSON.stringify({ ...copy, titleEn: 42 }))).toBeNull();
  });

  it("compares all four fields so a candidate becomes stale after further editing", () => {
    expect(sameWeeklyDraftCopy(copy, { ...copy })).toBe(true);
    expect(sameWeeklyDraftCopy(copy, { ...copy, summaryZh: "继续编辑" })).toBe(false);
  });
});
