import { describe, expect, it } from "vitest";

import { createOkrService } from "../src/lib/services/okr";
import { actionItemInputSchema } from "../src/lib/validators/okr";

describe("action item validation", () => {
  const base = {
    keyResultId: "kr-1",
    titleZh: "完成接口联调",
    titleEn: null,
    status: "TODO",
    dueDate: null,
    sortOrder: 0,
    recurrenceInterval: 1,
  };

  it("normalizes weekly recurrence days", () => {
    const parsed = actionItemInputSchema.parse({
      ...base,
      recurrenceType: "WEEKLY",
      recurrenceDays: [5, 1, 5, 3],
    });

    expect(parsed.recurrenceDays).toBe("1,3,5");
  });

  it("requires days for weekly recurrence", () => {
    expect(() => actionItemInputSchema.parse({
      ...base,
      recurrenceType: "WEEKLY",
      recurrenceDays: null,
    })).toThrow("每周重复至少选择一天");
  });

  it("rejects recurrence days for non-weekly actions", () => {
    expect(() => actionItemInputSchema.parse({
      ...base,
      recurrenceType: "DAILY",
      recurrenceDays: [1],
    })).toThrow("仅每周重复可以设置星期");
  });
});

describe("action item service", () => {
  it("rejects a missing key result parent", async () => {
    const service = createOkrService({
      async findKeyResultForAction() { return null; },
      async createActionItem() { throw new Error("must not create"); },
    });

    await expect(service.createActionItem({
      keyResultId: "missing",
      titleZh: "不会创建",
      status: "TODO",
      recurrenceType: "NONE",
      recurrenceInterval: 1,
      recurrenceDays: null,
      sortOrder: 0,
    })).rejects.toThrow("Key Result 不存在");
  });

  it("sets completion time without changing key result progress", async () => {
    const keyResult = { id: "kr-1", currentValue: 4, manualProgress: null };
    let created: Record<string, unknown> | undefined;
    const service = createOkrService({
      async findKeyResultForAction(id) { return id === keyResult.id ? keyResult : null; },
      async createActionItem(values) {
        created = values;
        return { id: "action-1", ...values };
      },
    });

    await service.createActionItem({
      keyResultId: "kr-1",
      titleZh: "完成联调",
      status: "DONE",
      recurrenceType: "NONE",
      recurrenceInterval: 1,
      recurrenceDays: null,
      sortOrder: 0,
    });

    expect(created?.completedAt).toBeInstanceOf(Date);
    expect(keyResult).toEqual({ id: "kr-1", currentValue: 4, manualProgress: null });
  });

  it("preserves or clears completion time as status changes", async () => {
    const completedAt = new Date("2026-09-14T08:00:00.000Z");
    const action = {
      id: "action-1",
      keyResultId: "kr-1",
      titleZh: "完成联调",
      titleEn: null,
      status: "DONE",
      dueDate: null,
      sortOrder: 0,
      recurrenceType: "NONE",
      recurrenceInterval: 1,
      recurrenceDays: null,
      completedAt,
    };
    const updates: Array<Record<string, unknown>> = [];
    const service = createOkrService({
      async findActionItem() { return action; },
      async findKeyResultForAction() { return { id: "kr-1" }; },
      async updateActionItem(_id, values) {
        updates.push(values);
        Object.assign(action, values);
        return action;
      },
    });

    await service.updateActionItem("action-1", { titleZh: "更新标题" });
    await service.updateActionItem("action-1", { status: "IN_PROGRESS" });

    expect(updates[0]).not.toHaveProperty("completedAt");
    expect(updates[1]).toMatchObject({ status: "IN_PROGRESS", completedAt: null });
  });
});
