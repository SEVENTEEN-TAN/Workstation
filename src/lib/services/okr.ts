import { Prisma, type ActionItem, type KeyResult, type Objective, type PrismaClient } from "@prisma/client";

import { getDatabase } from "../db";
import { calculateKeyResultProgress, calculateObjectiveProgress } from "../okr/progress";
import { actionItemInputSchema, actionItemPatchSchema, cycleInputSchema, cyclePatchSchema, keyResultInputSchema, keyResultPatchSchema, objectiveInputSchema, objectivePatchSchema, progressInputSchema, reviewInputSchema, reviewPatchSchema } from "../validators/okr";
import {
  buildCompletionMilestoneDraft,
  buildProgressMilestoneDraft,
  type OkrMilestoneDraftWrite,
} from "./okr-milestone-drafts";

type OkrParent = { titleZh: string; titleEn: string | null; cycle: { nameZh: string; nameEn: string | null } };
type ProgressKeyResult = KeyResult & { objective: OkrParent };
type ObjectiveForUpdate = Objective & { cycle: { nameZh: string; nameEn: string | null } };
type KeyResultForUpdate = KeyResult & { objective: OkrParent };

type ProgressTransaction = {
  findKeyResult(id: string): Promise<ProgressKeyResult | null>;
  updateKeyResultProgress(id: string, values: { currentValue: number | null; manualProgress: number | null }): Promise<ProgressKeyResult>;
  createProgressUpdate(values: ProgressUpdateValues): Promise<unknown>;
  createMilestoneDraft(values: OkrMilestoneDraftWrite): Promise<unknown>;
};

type ProgressUpdateValues = {
  keyResultId: string;
  currentValue: number | null;
  manualProgress: number | null;
  calculatedProgress: number;
  noteZh: string | null;
  noteEn: string | null;
  recordedAt: Date;
};

type EntityTransaction = {
  findObjectiveForUpdate(id: string): Promise<ObjectiveForUpdate | null>;
  updateObjectiveRecord(id: string, values: Prisma.ObjectiveUncheckedUpdateInput): Promise<ObjectiveForUpdate>;
  findKeyResultForUpdate(id: string): Promise<KeyResultForUpdate | null>;
  updateKeyResultRecord(id: string, values: Prisma.KeyResultUncheckedUpdateInput): Promise<KeyResultForUpdate>;
  createMilestoneDraft(values: OkrMilestoneDraftWrite): Promise<unknown>;
};

type OkrRepositoryOverrides = {
  transaction?<T>(run: (transaction: ProgressTransaction) => Promise<T>): Promise<T>;
  entityTransaction?<T>(run: (transaction: EntityTransaction) => Promise<T>): Promise<T>;
  findKeyResultForAction?(id: string): Promise<{ id: string } | null>;
  createActionItem?(values: Prisma.ActionItemUncheckedCreateInput): Promise<unknown>;
  findActionItem?(id: string): Promise<ActionItem | null>;
  updateActionItem?(id: string, values: Prisma.ActionItemUncheckedUpdateInput): Promise<unknown>;
  deleteActionItem?(id: string): Promise<unknown>;
  listCycles?(): Promise<unknown[]>;
  findCycle?(id: string): Promise<unknown | null>;
  findObjective?(id: string): Promise<{ cycleId: string } & Record<string, unknown> | null>;
};

function progressRepository(database: PrismaClient): OkrRepositoryOverrides {
  return {
    transaction: (run) => database.$transaction((transaction) => run({
      findKeyResult: (id) => transaction.keyResult.findUnique({
        where: { id }, include: { objective: { include: { cycle: true } } },
      }),
      updateKeyResultProgress: (id, values) => transaction.keyResult.update({
        where: { id }, data: values, include: { objective: { include: { cycle: true } } },
      }),
      createProgressUpdate: (values) => transaction.krProgressUpdate.create({ data: values }),
      createMilestoneDraft: (values) => transaction.okrMilestoneDraft.upsert({
        where: { sourceKey: values.sourceKey },
        create: { ...values, sourceSnapshot: JSON.parse(JSON.stringify(values.sourceSnapshot)) as Prisma.InputJsonValue },
        update: {},
      }),
    })),
  };
}

function entityRepository(database: PrismaClient): OkrRepositoryOverrides {
  return {
    entityTransaction: (run) => database.$transaction((transaction) => run({
      findObjectiveForUpdate: (id) => transaction.objective.findUnique({ where: { id }, include: { cycle: true } }),
      updateObjectiveRecord: (id, values) => transaction.objective.update({ where: { id }, data: values, include: { cycle: true } }),
      findKeyResultForUpdate: (id) => transaction.keyResult.findUnique({
        where: { id }, include: { objective: { include: { cycle: true } } },
      }),
      updateKeyResultRecord: (id, values) => transaction.keyResult.update({
        where: { id }, data: values, include: { objective: { include: { cycle: true } } },
      }),
      createMilestoneDraft: (values) => transaction.okrMilestoneDraft.upsert({
        where: { sourceKey: values.sourceKey },
        create: { ...values, sourceSnapshot: JSON.parse(JSON.stringify(values.sourceSnapshot)) as Prisma.InputJsonValue },
        update: {},
      }),
    })),
  };
}

function progressForRecord(record: Pick<KeyResult, "progressMode" | "manualProgress" | "startValue" | "currentValue" | "targetValue">) {
  return record.progressMode === "MANUAL"
    ? calculateKeyResultProgress({ mode: "MANUAL", manualProgress: record.manualProgress ?? 0 })
    : calculateKeyResultProgress({ mode: "METRIC", startValue: record.startValue ?? 0, currentValue: record.currentValue ?? record.startValue ?? 0, targetValue: record.targetValue ?? 0 });
}

export function createOkrService(repositoryOverride?: OkrRepositoryOverrides) {
  const database = () => getDatabase();
  return {
    async listCycles() {
      if (repositoryOverride?.listCycles) return repositoryOverride.listCycles();
      return (await database()).okrCycle.findMany({
        orderBy: { startDate: "desc" },
        include: {
          objectives: {
            orderBy: { sortOrder: "asc" },
            include: {
              keyResults: {
                orderBy: { sortOrder: "asc" },
                include: { progressUpdates: { orderBy: { recordedAt: "desc" }, take: 1 } },
              },
            },
          },
          reviews: { orderBy: { reviewedAt: "desc" } },
        },
      });
    },
    async getCycle(id: string) {
      if (repositoryOverride?.findCycle) return repositoryOverride.findCycle(id);
      return (await database()).okrCycle.findUnique({
        where: { id },
        include: {
          objectives: {
            orderBy: { sortOrder: "asc" },
            include: {
              keyResults: {
                orderBy: { sortOrder: "asc" },
                include: {
                  progressUpdates: { orderBy: { recordedAt: "desc" }, take: 20 },
                  actionItems: { orderBy: { sortOrder: "asc" } },
                },
              },
            },
          },
          reviews: { orderBy: { reviewedAt: "desc" } },
        },
      });
    },
    async getObjective(id: string, cycleId?: string) {
      const objective = repositoryOverride?.findObjective
        ? await repositoryOverride.findObjective(id)
        : await (await database()).objective.findUnique({
          where: { id },
          include: {
            cycle: true,
            keyResults: {
              orderBy: { sortOrder: "asc" },
              include: {
                progressUpdates: { orderBy: { recordedAt: "desc" }, take: 20 },
                actionItems: { orderBy: { sortOrder: "asc" } },
              },
            },
            reviews: { orderBy: { reviewedAt: "desc" } },
          },
        });
      if (!objective || (cycleId && objective.cycleId !== cycleId)) return null;
      return objective;
    },
    async listAll() {
      return (await database()).okrCycle.findMany({
        orderBy: { startDate: "desc" },
        include: {
          objectives: { orderBy: { sortOrder: "asc" }, include: { keyResults: { orderBy: { sortOrder: "asc" }, include: { progressUpdates: { orderBy: { recordedAt: "desc" }, take: 20 }, actionItems: { orderBy: { sortOrder: "asc" } } } } } },
          reviews: { orderBy: { reviewedAt: "desc" } },
        },
      });
    },
    async createCycle(input: unknown) {
      return (await database()).okrCycle.create({ data: cycleInputSchema.parse(input) });
    },
    async updateCycle(id: string, input: unknown) {
      return (await database()).okrCycle.update({ where: { id }, data: cyclePatchSchema.parse(input) });
    },
    async deleteCycle(id: string) {
      return (await database()).okrCycle.delete({ where: { id } });
    },
    async createObjective(input: unknown) {
      const parsed = objectiveInputSchema.parse(input);
      const db = await database();
      if (!(await db.okrCycle.findUnique({ where: { id: parsed.cycleId }, select: { id: true } }))) throw new Error("OKR 周期不存在");
      return db.objective.create({ data: parsed });
    },
    async updateObjective(id: string, input: unknown) {
      const parsed = objectivePatchSchema.parse(input);
      const db = repositoryOverride?.entityTransaction ? null : await database();
      if (parsed.cycleId && db && !(await db.okrCycle.findUnique({ where: { id: parsed.cycleId }, select: { id: true } }))) throw new Error("OKR 周期不存在");
      const repo = repositoryOverride?.entityTransaction ? repositoryOverride : entityRepository(db!);
      return repo.entityTransaction!(async (transaction) => {
        const current = await transaction.findObjectiveForUpdate(id);
        if (!current) throw new Error("Objective 不存在");
        const wasCompleted = current.status === "COMPLETED";
        const updated = await transaction.updateObjectiveRecord(id, parsed);
        if (parsed.status === "COMPLETED" && !wasCompleted) {
          await transaction.createMilestoneDraft(buildCompletionMilestoneDraft({
            kind: "OBJECTIVE_COMPLETED",
            entityId: updated.id,
            titleZh: updated.titleZh,
            titleEn: updated.titleEn,
            parentZh: updated.cycle.nameZh,
            parentEn: updated.cycle.nameEn,
            occurredAt: new Date(),
          }));
        }
        const { cycle: _cycle, ...record } = updated;
        void _cycle;
        return record;
      });
    },
    async deleteObjective(id: string) {
      return (await database()).objective.delete({ where: { id } });
    },
    async createKeyResult(input: unknown) {
      const parsed = keyResultInputSchema.parse(input);
      const db = await database();
      if (!(await db.objective.findUnique({ where: { id: parsed.objectiveId }, select: { id: true } }))) throw new Error("Objective 不存在");
      return db.keyResult.create({ data: parsed });
    },
    async updateKeyResult(id: string, input: unknown) {
      const parsed = keyResultPatchSchema.parse(input);
      const db = repositoryOverride?.entityTransaction ? null : await database();
      if (parsed.objectiveId && db && !(await db.objective.findUnique({ where: { id: parsed.objectiveId }, select: { id: true } }))) throw new Error("Objective 不存在");
      const repo = repositoryOverride?.entityTransaction ? repositoryOverride : entityRepository(db!);
      return repo.entityTransaction!(async (transaction) => {
        const current = await transaction.findKeyResultForUpdate(id);
        if (!current) throw new Error("Key Result 不存在");
        const wasCompleted = current.status === "COMPLETED";
        const updated = await transaction.updateKeyResultRecord(id, parsed);
        if (parsed.status === "COMPLETED" && !wasCompleted) {
          await transaction.createMilestoneDraft(buildCompletionMilestoneDraft({
            kind: "KEY_RESULT_COMPLETED",
            entityId: updated.id,
            titleZh: updated.titleZh,
            titleEn: updated.titleEn,
            parentZh: updated.objective.titleZh,
            parentEn: updated.objective.titleEn,
            occurredAt: new Date(),
          }));
        }
        const { objective: _objective, ...record } = updated;
        void _objective;
        return record;
      });
    },
    async deleteKeyResult(id: string) {
      return (await database()).keyResult.delete({ where: { id } });
    },
    async recordProgress(id: string, input: unknown) {
      const parsed = progressInputSchema.parse(input);
      const repo = repositoryOverride?.transaction ? repositoryOverride : progressRepository(await database());
      return repo.transaction!(async (transaction) => {
        const current = await transaction.findKeyResult(id);
        if (!current) throw new Error("Key Result 不存在");
        const previousProgress = progressForRecord(current);
        const recordedAt = new Date();
        const values = current.progressMode === "MANUAL"
          ? { currentValue: current.currentValue ?? null, manualProgress: parsed.manualProgress ?? current.manualProgress ?? 0 }
          : { currentValue: parsed.currentValue ?? current.currentValue ?? current.startValue ?? 0, manualProgress: null };
        if (current.progressMode === "MANUAL" && parsed.manualProgress == null) throw new Error("手动型 KR 需要 manualProgress");
        if (current.progressMode === "METRIC" && parsed.currentValue == null) throw new Error("数值型 KR 需要 currentValue");
        const updated = await transaction.updateKeyResultProgress(id, values);
        const progress = progressForRecord(updated);
        await transaction.createProgressUpdate({
          keyResultId: id,
          currentValue: values.currentValue,
          manualProgress: values.manualProgress,
          calculatedProgress: progress,
          noteZh: parsed.noteZh ?? null,
          noteEn: parsed.noteEn ?? null,
          recordedAt,
        });
        const milestone = buildProgressMilestoneDraft({
          keyResultId: updated.id,
          keyResultTitleZh: updated.titleZh,
          keyResultTitleEn: updated.titleEn,
          objectiveTitleZh: updated.objective.titleZh,
          objectiveTitleEn: updated.objective.titleEn,
          cycleNameZh: updated.objective.cycle.nameZh,
          cycleNameEn: updated.objective.cycle.nameEn,
          previousProgress,
          progress,
          noteZh: parsed.noteZh ?? null,
          noteEn: parsed.noteEn ?? null,
          occurredAt: recordedAt,
        });
        if (milestone) await transaction.createMilestoneDraft(milestone);
        return { keyResult: updated, progress };
      });
    },
    async createReview(input: unknown) {
      const parsed = reviewInputSchema.parse(input);
      const db = await database();
      const cycle = await db.okrCycle.findUnique({ where: { id: parsed.cycleId }, select: { id: true } });
      if (!cycle) throw new Error("OKR 周期不存在");
      if (parsed.objectiveId) {
        const objective = await db.objective.findUnique({ where: { id: parsed.objectiveId }, select: { cycleId: true } });
        if (!objective || objective.cycleId !== parsed.cycleId) throw new Error("复盘关联的 Objective 不属于该周期");
      }
      return db.review.create({ data: parsed });
    },
    async updateReview(id: string, input: unknown) {
      const parsed = reviewPatchSchema.parse(input);
      const db = await database();
      const existing = await db.review.findUnique({ where: { id }, select: { cycleId: true, objectiveId: true } });
      if (!existing) throw new Error("复盘不存在");
      const cycleId = parsed.cycleId ?? existing.cycleId;
      const objectiveId = parsed.objectiveId === undefined ? existing.objectiveId : parsed.objectiveId;
      if (objectiveId) {
        const objective = await db.objective.findUnique({ where: { id: objectiveId }, select: { cycleId: true } });
        if (!objective || objective.cycleId !== cycleId) throw new Error("复盘关联的 Objective 不属于该周期");
      }
      return db.review.update({ where: { id }, data: parsed });
    },
    async deleteReview(id: string) {
      return (await database()).review.delete({ where: { id } });
    },
    async createActionItem(input: unknown) {
      const parsed = actionItemInputSchema.parse(input);
      const db = repositoryOverride?.findKeyResultForAction && repositoryOverride.createActionItem
        ? null
        : await database();
      const keyResult = repositoryOverride?.findKeyResultForAction
        ? await repositoryOverride.findKeyResultForAction(parsed.keyResultId)
        : await db!.keyResult.findUnique({ where: { id: parsed.keyResultId }, select: { id: true } });
      if (!keyResult) throw new Error("Key Result 不存在");
      const values: Prisma.ActionItemUncheckedCreateInput = {
        ...parsed,
        completedAt: parsed.status === "DONE" ? new Date() : null,
      };
      return repositoryOverride?.createActionItem
        ? repositoryOverride.createActionItem(values)
        : db!.actionItem.create({ data: values });
    },
    async updateActionItem(id: string, input: unknown) {
      const patch = actionItemPatchSchema.parse(input);
      const db = repositoryOverride?.findActionItem && repositoryOverride.updateActionItem
        ? null
        : await database();
      const existing = repositoryOverride?.findActionItem
        ? await repositoryOverride.findActionItem(id)
        : await db!.actionItem.findUnique({ where: { id } });
      if (!existing) throw new Error("Action Item 不存在");
      const normalized = actionItemInputSchema.parse({ ...existing, ...patch });
      if (patch.keyResultId && patch.keyResultId !== existing.keyResultId) {
        const keyResult = repositoryOverride?.findKeyResultForAction
          ? await repositoryOverride.findKeyResultForAction(patch.keyResultId)
          : await db!.keyResult.findUnique({ where: { id: patch.keyResultId }, select: { id: true } });
        if (!keyResult) throw new Error("Key Result 不存在");
      }
      const values: Prisma.ActionItemUncheckedUpdateInput = {};
      if (patch.keyResultId !== undefined) values.keyResultId = normalized.keyResultId;
      if (patch.titleZh !== undefined) values.titleZh = normalized.titleZh;
      if (patch.titleEn !== undefined) values.titleEn = normalized.titleEn;
      if (patch.status !== undefined) values.status = normalized.status;
      if (patch.dueDate !== undefined) values.dueDate = normalized.dueDate ?? null;
      if (patch.sortOrder !== undefined) values.sortOrder = normalized.sortOrder;
      if (patch.recurrenceType !== undefined) values.recurrenceType = normalized.recurrenceType;
      if (patch.recurrenceInterval !== undefined) values.recurrenceInterval = normalized.recurrenceInterval;
      if (patch.recurrenceDays !== undefined) values.recurrenceDays = normalized.recurrenceDays;
      if (patch.status === "DONE") values.completedAt = existing.completedAt ?? new Date();
      if (patch.status && patch.status !== "DONE") values.completedAt = null;
      return repositoryOverride?.updateActionItem
        ? repositoryOverride.updateActionItem(id, values)
        : db!.actionItem.update({ where: { id }, data: values });
    },
    async deleteActionItem(id: string) {
      if (repositoryOverride?.deleteActionItem) return repositoryOverride.deleteActionItem(id);
      return (await database()).actionItem.delete({ where: { id } });
    },
    async getDashboard() {
      const cycles = await this.listAll();
      const objectives = cycles.flatMap((cycle) => cycle.objectives).map((objective) => {
        const progress = calculateObjectiveProgress(objective.keyResults.map((keyResult) => ({ progress: progressForRecord(keyResult), weight: keyResult.weight })));
        return { id: objective.id, titleZh: objective.titleZh, status: objective.status, progress, endDate: objective.endDate };
      });
      const averageProgress = objectives.length ? Math.round((objectives.reduce((sum, objective) => sum + objective.progress, 0) / objectives.length) * 100) / 100 : 0;
      return {
        cycleCount: cycles.length,
        objectiveCount: objectives.length,
        completedObjectives: objectives.filter((objective) => objective.status === "COMPLETED").length,
        atRiskObjectives: objectives.filter((objective) => objective.status === "AT_RISK" || (objective.endDate && objective.endDate < new Date() && objective.progress < 100)).length,
        averageProgress,
        objectives,
      };
    },
  };
}

export const okrService = createOkrService();

export function formatServiceError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return "记录不存在";
  return "请求处理失败";
}
