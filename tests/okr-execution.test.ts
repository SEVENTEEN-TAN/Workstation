import { describe, expect, it } from "vitest";

import {
  getKeyResultExecutionState,
  summarizeCycle,
  summarizeObjective,
} from "../src/lib/okr/execution";

const now = new Date("2026-09-15T12:00:00.000Z");

describe("getKeyResultExecutionState", () => {
  it("marks incomplete key results overdue when the inherited due date is before today", () => {
    const state = getKeyResultExecutionState(
      {
        status: "IN_PROGRESS",
        progressMode: "METRIC",
        startValue: 0,
        currentValue: 60,
        targetValue: 100,
        weight: 1,
        updatedAt: new Date("2026-09-14T09:00:00.000Z"),
        objectiveEndDate: new Date("2026-09-14T23:59:59.000Z"),
        cycleEndDate: new Date("2026-09-30T23:59:59.000Z"),
        progressUpdates: [],
      },
      now,
    );

    expect(state).toMatchObject({
      progress: 60,
      overdue: true,
      stale: false,
      dueSoon: false,
      atRisk: true,
    });
  });

  it("uses the latest check-in timestamp before falling back to KR updatedAt for stale detection", () => {
    const stale = getKeyResultExecutionState(
      {
        status: "IN_PROGRESS",
        progressMode: "MANUAL",
        manualProgress: 50,
        weight: 1,
        updatedAt: new Date("2026-09-14T09:00:00.000Z"),
        cycleEndDate: new Date("2026-10-01T00:00:00.000Z"),
        progressUpdates: [{ recordedAt: new Date("2026-09-01T08:00:00.000Z") }],
      },
      now,
    );

    const active = getKeyResultExecutionState(
      {
        status: "IN_PROGRESS",
        progressMode: "MANUAL",
        manualProgress: 50,
        weight: 1,
        updatedAt: new Date("2026-09-14T09:00:00.000Z"),
        cycleEndDate: new Date("2026-10-01T00:00:00.000Z"),
        progressUpdates: [{ recordedAt: new Date("2026-09-02T08:00:00.000Z") }],
      },
      now,
    );

    expect(stale.stale).toBe(true);
    expect(stale.atRisk).toBe(false);
    expect(active.stale).toBe(false);
  });

  it("marks due-soon key results at risk when progress is below 70 percent", () => {
    const lowProgress = getKeyResultExecutionState(
      {
        status: "IN_PROGRESS",
        progressMode: "METRIC",
        startValue: 0,
        currentValue: 69,
        targetValue: 100,
        weight: 1,
        updatedAt: new Date("2026-09-15T09:00:00.000Z"),
        cycleEndDate: new Date("2026-09-22T23:59:59.000Z"),
        progressUpdates: [],
      },
      now,
    );

    const enoughProgress = getKeyResultExecutionState(
      {
        status: "IN_PROGRESS",
        progressMode: "METRIC",
        startValue: 0,
        currentValue: 70,
        targetValue: 100,
        weight: 1,
        updatedAt: new Date("2026-09-15T09:00:00.000Z"),
        cycleEndDate: new Date("2026-09-22T23:59:59.000Z"),
        progressUpdates: [],
      },
      now,
    );

    expect(lowProgress).toMatchObject({ dueSoon: true, atRisk: true });
    expect(enoughProgress).toMatchObject({ dueSoon: true, atRisk: false });
  });

  it("excludes completed and cancelled key results from risk signals", () => {
    for (const status of ["COMPLETED", "CANCELLED"]) {
      expect(
        getKeyResultExecutionState(
          {
            status,
            progressMode: "MANUAL",
            manualProgress: 10,
            weight: 1,
            updatedAt: new Date("2026-08-01T09:00:00.000Z"),
            cycleEndDate: new Date("2026-09-01T00:00:00.000Z"),
            progressUpdates: [],
          },
          now,
        ),
      ).toMatchObject({
        overdue: false,
        stale: false,
        dueSoon: false,
        atRisk: false,
      });
    }
  });
});

describe("summarizeObjective", () => {
  it("returns weighted progress and execution counts for objective key results", () => {
    const summary = summarizeObjective(
      {
        id: "objective-1",
        status: "IN_PROGRESS",
        endDate: new Date("2026-09-22T23:59:59.000Z"),
        keyResults: [
          {
            id: "kr-1",
            status: "IN_PROGRESS",
            progressMode: "MANUAL",
            manualProgress: 50,
            weight: 1,
            updatedAt: new Date("2026-09-15T09:00:00.000Z"),
            progressUpdates: [],
          },
          {
            id: "kr-2",
            status: "COMPLETED",
            progressMode: "MANUAL",
            manualProgress: 100,
            weight: 3,
            updatedAt: new Date("2026-09-01T09:00:00.000Z"),
            progressUpdates: [],
          },
        ],
      },
      now,
    );

    expect(summary.progress).toBe(87.5);
    expect(summary.counts).toEqual({
      total: 2,
      completed: 1,
      overdue: 0,
      stale: 0,
      atRisk: 1,
    });
  });
});

describe("summarizeCycle", () => {
  it("returns equal average progress across objectives and rolled-up risk counts", () => {
    const summary = summarizeCycle(
      {
        id: "cycle-1",
        endDate: new Date("2026-09-30T23:59:59.000Z"),
        objectives: [
          {
            id: "objective-1",
            status: "IN_PROGRESS",
            endDate: new Date("2026-09-22T23:59:59.000Z"),
            keyResults: [
              {
                id: "kr-1",
                status: "IN_PROGRESS",
                progressMode: "MANUAL",
                manualProgress: 50,
                weight: 1,
                updatedAt: new Date("2026-09-15T09:00:00.000Z"),
                progressUpdates: [],
              },
            ],
          },
          {
            id: "objective-2",
            status: "IN_PROGRESS",
            keyResults: [
              {
                id: "kr-2",
                status: "IN_PROGRESS",
                progressMode: "MANUAL",
                manualProgress: 100,
                weight: 1,
                updatedAt: new Date("2026-09-15T09:00:00.000Z"),
                progressUpdates: [],
              },
            ],
          },
        ],
      },
      now,
    );

    expect(summary.progress).toBe(75);
    expect(summary.counts).toMatchObject({
      objectives: 2,
      keyResults: 2,
      atRisk: 1,
    });
  });
});
