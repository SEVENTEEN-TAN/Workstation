import { describe, expect, it } from "vitest";

import {
  calculateKeyResultProgress,
  calculateObjectiveProgress,
} from "../src/lib/okr/progress";

describe("calculateKeyResultProgress", () => {
  it("calculates a forward metric", () => {
    expect(
      calculateKeyResultProgress({
        mode: "METRIC",
        startValue: 0,
        currentValue: 45,
        targetValue: 100,
      }),
    ).toBe(45);
  });

  it("calculates a decreasing metric", () => {
    expect(
      calculateKeyResultProgress({
        mode: "METRIC",
        startValue: 100,
        currentValue: 60,
        targetValue: 0,
      }),
    ).toBe(40);
  });

  it.each([
    [-20, 0],
    [200, 100],
  ])("clamps a forward metric current value %s to %s%%", (currentValue, expected) => {
    expect(
      calculateKeyResultProgress({
        mode: "METRIC",
        startValue: 0,
        currentValue,
        targetValue: 100,
      }),
    ).toBe(expected);
  });

  it("treats an unchanged metric target as complete only at that value", () => {
    expect(
      calculateKeyResultProgress({
        mode: "METRIC",
        startValue: 20,
        currentValue: 20,
        targetValue: 20,
      }),
    ).toBe(100);
    expect(
      calculateKeyResultProgress({
        mode: "METRIC",
        startValue: 20,
        currentValue: 19,
        targetValue: 20,
      }),
    ).toBe(0);
  });

  it("uses and clamps manual progress", () => {
    expect(calculateKeyResultProgress({ mode: "MANUAL", manualProgress: 65 })).toBe(65);
    expect(calculateKeyResultProgress({ mode: "MANUAL", manualProgress: 120 })).toBe(100);
  });
});

describe("calculateObjectiveProgress", () => {
  it("calculates a weighted average", () => {
    expect(
      calculateObjectiveProgress([
        { progress: 50, weight: 1 },
        { progress: 100, weight: 3 },
      ]),
    ).toBe(87.5);
  });

  it("uses equal weights when weights are omitted", () => {
    expect(calculateObjectiveProgress([{ progress: 25 }, { progress: 75 }])).toBe(50);
    expect(calculateObjectiveProgress([])).toBe(0);
  });
});
