import { describe, expect, it, vi } from "vitest";
import type { ActionItem } from "@prisma/client";

import { createOkrService } from "../src/lib/services/okr";
import { actionItemInputSchema, actionItemPatchSchema } from "../src/lib/validators/okr";

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
    const harness = recurringActionHarness("NONE", "DONE");
    await harness.service.updateActionItem("action-1", { titleZh: "更新标题" });
    await harness.service.updateActionItem("action-1", { status: "IN_PROGRESS" });

    expect(harness.updates[0]).not.toHaveProperty("completedAt");
    expect(harness.updates[1]).toMatchObject({ status: "IN_PROGRESS", completedAt: null });
  });

  it("keeps an omitted recurrence day patch absent", () => {
    expect(actionItemPatchSchema.parse({ status: "DONE" }).recurrenceDays).toBeUndefined();
  });
});

function recurringActionHarness(
  recurrenceType: "DAILY" | "WEEKLY" | "NONE" = "DAILY",
  initialStatus: "TODO" | "DONE" = "TODO",
  dueDate: Date | null = new Date("2026-09-23T00:00:00.000Z"),
  afterClaim?: () => void,
) {
  const updates: Array<Record<string, unknown>> = [];
  let action = {
    id: "action-1", keyResultId: "kr-1", titleZh: "完成联调", titleEn: "Finish integration",
    status: initialStatus, dueDate, sortOrder: 2,
    recurrenceType, recurrenceInterval: 1, recurrenceDays: recurrenceType === "WEEKLY" ? "1,4" : null,
    completedAt: initialStatus === "DONE" ? new Date("2026-09-14T08:00:00.000Z") : null,
    createdAt: new Date("2026-09-22T00:00:00.000Z"),
    updatedAt: new Date("2026-09-22T00:00:00.000Z"),
    generatedFromActionItemId: null, hasGeneratedNext: false,
  } as ActionItem;
  let successors: Array<Record<string, unknown>> = [];
  let rejectCreate = false;
  const update = async (_id: string, values: Record<string, unknown>) => {
    updates.push(values);
    action = { ...action, ...values } as ActionItem;
    return action;
  };
  const transaction = async <T>(run: (repository: {
    findActionItem(id: string): Promise<ActionItem | null>;
    findKeyResultForAction(id: string): Promise<{ id: string } | null>;
    updateActionItem(id: string, values: Record<string, unknown>): Promise<ActionItem>;
    claimActionItem(id: string, values: Record<string, unknown>): Promise<boolean>;
    createActionItem(values: Record<string, unknown>): Promise<Record<string, unknown>>;
  }) => Promise<T>): Promise<T> => {
    const before = { ...action };
    const oldSuccessors = [...successors];
    try {
      return await run({
        findActionItem: async () => action,
        findKeyResultForAction: async () => ({ id: "kr-1" }),
        updateActionItem: update,
        claimActionItem: async (_id, values) => {
          if (action.status === "DONE" || action.hasGeneratedNext) return false;
          await update(action.id, values);
          afterClaim?.();
          return true;
        },
        createActionItem: async (values) => {
          if (rejectCreate) throw new Error("insertion failed");
          const successor = { id: `action-${successors.length + 2}`, ...values };
          successors.push(successor);
          return successor;
        },
      });
    } catch (error) {
      action = before as ActionItem;
      successors = oldSuccessors;
      throw error;
    }
  };
  const repository = {
    findActionItem: async () => action,
    updateActionItem: update,
    actionTransaction: transaction,
  };
  return {
    service: createOkrService(repository as unknown as Parameters<typeof createOkrService>[0]),
    get action() { return action; },
    get successors() { return successors; },
    updates,
    failNextInsert() { rejectCreate = true; },
    deleteSuccessor() { successors = []; },
  };
}

describe("recurring action completion", () => {
  it("uses the saved completion time when a due-date-free completion crosses Shanghai midnight", async () => {
    vi.useFakeTimers();
    try {
      const completedAt = new Date("2026-09-22T15:59:59.999Z");
      vi.setSystemTime(completedAt);
      const harness = recurringActionHarness("DAILY", "TODO", null, () => {
        vi.setSystemTime(new Date("2026-09-22T16:00:00.001Z"));
      });

      await harness.service.updateActionItem("action-1", { status: "DONE" });

      expect(harness.action.completedAt).toEqual(completedAt);
      expect(harness.successors[0]?.dueDate).toEqual(new Date("2026-09-23T00:00:00.000Z"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("completes a weekly action without clearing its selected weekdays", async () => {
    const harness = recurringActionHarness("WEEKLY");
    await harness.service.updateActionItem("action-1", { status: "DONE" });
    expect(harness.successors).toEqual([expect.objectContaining({
      recurrenceDays: "1,4", dueDate: new Date("2026-09-24T00:00:00.000Z"),
    })]);
  });

  it("creates one TODO successor with copied fields", async () => {
    const harness = recurringActionHarness();

    await harness.service.updateActionItem("action-1", { status: "DONE" });

    expect(harness.action).toMatchObject({ status: "DONE", hasGeneratedNext: true });
    expect(harness.successors).toEqual([expect.objectContaining({
      keyResultId: "kr-1", titleZh: "完成联调", titleEn: "Finish integration",
      status: "TODO", sortOrder: 2, recurrenceType: "DAILY", recurrenceInterval: 1,
      recurrenceDays: null, generatedFromActionItemId: "action-1",
      dueDate: new Date("2026-09-24T00:00:00.000Z"), completedAt: null,
    })]);
  });

  it("does not create a successor for a nonrecurring action", async () => {
    const harness = recurringActionHarness("NONE");
    await harness.service.updateActionItem("action-1", { status: "DONE" });
    expect(harness.successors).toHaveLength(0);
    expect(harness.action.hasGeneratedNext).toBe(false);
  });

  it("does not generate twice after repeated completion, reopen, or successor deletion", async () => {
    const harness = recurringActionHarness();
    await harness.service.updateActionItem("action-1", { status: "DONE" });
    await harness.service.updateActionItem("action-1", { status: "DONE" });
    await harness.service.updateActionItem("action-1", { status: "IN_PROGRESS" });
    harness.deleteSuccessor();
    await harness.service.updateActionItem("action-1", { status: "DONE" });
    expect(harness.successors).toHaveLength(0);
    expect(harness.action.hasGeneratedNext).toBe(true);
  });

  it("rolls back completion when successor insertion fails", async () => {
    const harness = recurringActionHarness();
    harness.failNextInsert();
    await expect(harness.service.updateActionItem("action-1", { status: "DONE" })).rejects.toThrow("insertion failed");
    expect(harness.action).toMatchObject({ status: "TODO", hasGeneratedNext: false, completedAt: null });
    expect(harness.successors).toHaveLength(0);
  });
});
