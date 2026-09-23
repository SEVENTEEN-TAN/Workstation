import { describe, expect, it } from "vitest";

import { nextActionDueDate } from "../src/lib/okr/recurrence";

describe("next action due date", () => {
  it.each([
    {
      name: "daily date crosses a month",
      dueDate: "2026-09-30T00:00:00.000Z",
      completedAt: "2026-09-30T10:00:00.000Z",
      recurrenceType: "DAILY" as const,
      recurrenceInterval: 1,
      recurrenceDays: null,
      expected: "2026-10-01T00:00:00.000Z",
    },
    {
      name: "undated action completed before Shanghai midnight",
      dueDate: null,
      completedAt: "2026-09-22T15:59:00.000Z",
      recurrenceType: "DAILY" as const,
      recurrenceInterval: 1,
      recurrenceDays: null,
      expected: "2026-09-23T00:00:00.000Z",
    },
    {
      name: "undated action completed after Shanghai midnight",
      dueDate: null,
      completedAt: "2026-09-22T16:01:00.000Z",
      recurrenceType: "DAILY" as const,
      recurrenceInterval: 1,
      recurrenceDays: null,
      expected: "2026-09-24T00:00:00.000Z",
    },
    {
      name: "weekly action uses the next selected day in the same week",
      dueDate: "2026-09-21T00:00:00.000Z",
      completedAt: "2026-09-21T08:00:00.000Z",
      recurrenceType: "WEEKLY" as const,
      recurrenceInterval: 2,
      recurrenceDays: "1,4",
      expected: "2026-09-24T00:00:00.000Z",
    },
    {
      name: "weekly action crosses the specified number of weeks",
      dueDate: "2026-09-24T00:00:00.000Z",
      completedAt: "2026-09-24T08:00:00.000Z",
      recurrenceType: "WEEKLY" as const,
      recurrenceInterval: 2,
      recurrenceDays: "1,4",
      expected: "2026-10-05T00:00:00.000Z",
    },
    {
      name: "Sunday rolls to the next Monday",
      dueDate: "2026-09-27T00:00:00.000Z",
      completedAt: "2026-09-27T08:00:00.000Z",
      recurrenceType: "WEEKLY" as const,
      recurrenceInterval: 1,
      recurrenceDays: "1",
      expected: "2026-09-28T00:00:00.000Z",
    },
  ])("$name", ({ dueDate, completedAt, recurrenceType, recurrenceInterval, recurrenceDays, expected }) => {
    expect(nextActionDueDate({
      dueDate: dueDate ? new Date(dueDate) : null,
      completedAt: new Date(completedAt),
      recurrenceType,
      recurrenceInterval,
      recurrenceDays,
    }).toISOString()).toBe(expected);
  });
});
