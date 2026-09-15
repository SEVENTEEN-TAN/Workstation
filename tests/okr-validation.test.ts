import { describe, expect, it } from "vitest";

import {
  cyclePatchSchema,
  keyResultPatchSchema,
  objectivePatchSchema,
  reviewPatchSchema,
} from "../src/lib/validators/okr";

describe("OKR patch validation", () => {
  it("accepts status-only patches for refined OKR entities", () => {
    expect(cyclePatchSchema.parse({ status: "ACTIVE" })).toEqual({ status: "ACTIVE" });
    expect(objectivePatchSchema.parse({ status: "AT_RISK" })).toEqual({ status: "AT_RISK" });
    expect(keyResultPatchSchema.parse({ status: "COMPLETED" })).toEqual({ status: "COMPLETED" });
    expect(reviewPatchSchema.parse({ visibility: "PUBLIC" })).toEqual({ visibility: "PUBLIC" });
  });

  it("keeps cross-field validation when a patch supplies both values", () => {
    expect(() => cyclePatchSchema.parse({ startDate: "2026-12-31", endDate: "2026-01-01" })).toThrow("结束日期不能早于开始日期");
    expect(() => objectivePatchSchema.parse({ startDate: "2026-12-31", endDate: "2026-01-01" })).toThrow("结束日期不能早于开始日期");
    expect(() => keyResultPatchSchema.parse({ progressMode: "MANUAL" })).toThrow("手动型 KR 必须填写进度");
  });
});
