import { Prisma, type KeyResult, type PrismaClient } from "@prisma/client";

import { getDatabase } from "../db";
import { calculateKeyResultProgress, calculateObjectiveProgress } from "../okr/progress";
import { cycleInputSchema, keyResultInputSchema, objectiveInputSchema, progressInputSchema, reviewInputSchema } from "../validators/okr";

type ProgressTransaction = {
  findKeyResult(id: string): Promise<KeyResult | null>;
  updateKeyResultProgress(id: string, values: { currentValue: number | null; manualProgress: number | null }): Promise<KeyResult>;
  createProgressUpdate(values: ProgressUpdateValues): Promise<unknown>;
};

type ProgressUpdateValues = {
  keyResultId: string;
  currentValue: number | null;
  manualProgress: number | null;
  calculatedProgress: number;
  noteZh: string | null;
  noteEn: string | null;
};

type OkrRepositoryOverrides = {
  transaction<T>(run: (transaction: ProgressTransaction) => Promise<T>): Promise<T>;
};

function progressRepository(database: PrismaClient): OkrRepositoryOverrides {
  return {
    transaction: (run) => database.$transaction((transaction) => run({
      findKeyResult: (id) => transaction.keyResult.findUnique({ where: { id } }),
      updateKeyResultProgress: (id, values) => transaction.keyResult.update({ where: { id }, data: values }),
      createProgressUpdate: (values) => transaction.krProgressUpdate.create({ data: values }),
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
    async listAll() {
      return (await database()).okrCycle.findMany({
        orderBy: { startDate: "desc" },
        include: {
          objectives: { orderBy: { sortOrder: "asc" }, include: { keyResults: { orderBy: { sortOrder: "asc" }, include: { progressUpdates: { orderBy: { recordedAt: "desc" }, take: 20 } } } } },
          reviews: { orderBy: { reviewedAt: "desc" } },
        },
      });
    },
    async createCycle(input: unknown) {
      return (await database()).okrCycle.create({ data: cycleInputSchema.parse(input) });
    },
    async updateCycle(id: string, input: unknown) {
      return (await database()).okrCycle.update({ where: { id }, data: cycleInputSchema.partial().parse(input) });
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
      const parsed = objectiveInputSchema.partial().parse(input);
      const db = await database();
      if (parsed.cycleId && !(await db.okrCycle.findUnique({ where: { id: parsed.cycleId }, select: { id: true } }))) throw new Error("OKR 周期不存在");
      return db.objective.update({ where: { id }, data: parsed });
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
      const parsed = keyResultInputSchema.partial().parse(input);
      const db = await database();
      if (parsed.objectiveId && !(await db.objective.findUnique({ where: { id: parsed.objectiveId }, select: { id: true } }))) throw new Error("Objective 不存在");
      return db.keyResult.update({ where: { id }, data: parsed });
    },
    async deleteKeyResult(id: string) {
      return (await database()).keyResult.delete({ where: { id } });
    },
    async recordProgress(id: string, input: unknown) {
      const parsed = progressInputSchema.parse(input);
      const repo = repositoryOverride ?? progressRepository(await database());
      return repo.transaction(async (transaction) => {
        const current = await transaction.findKeyResult(id);
        if (!current) throw new Error("Key Result 不存在");
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
        });
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
      const parsed = reviewInputSchema.partial().parse(input);
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
