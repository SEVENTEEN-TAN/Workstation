import { summarizeCycle, summarizeObjective } from "../../../lib/okr/execution";
import type { ObjectiveData, OkrCycleData } from "../types";

export const cycleStatusLabels: Record<string, string> = {
  DRAFT: "草稿",
  ACTIVE: "进行中",
  COMPLETED: "已完成",
  ARCHIVED: "已归档",
};

export const objectiveStatusLabels: Record<string, string> = {
  NOT_STARTED: "未开始",
  IN_PROGRESS: "进行中",
  AT_RISK: "有风险",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
};

export function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("zh-CN") : "未设置";
}

export function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function executionKeyResult(keyResult: ObjectiveData["keyResults"][number], objectiveEndDate: string | null, cycleEndDate: string) {
  return {
    ...keyResult,
    progressMode: keyResult.progressMode as "METRIC" | "MANUAL",
    updatedAt: new Date(keyResult.updatedAt),
    objectiveEndDate: objectiveEndDate ? new Date(objectiveEndDate) : null,
    cycleEndDate: new Date(cycleEndDate),
    progressUpdates: keyResult.progressUpdates.map((update) => ({ recordedAt: new Date(update.recordedAt) })),
  };
}

export function getObjectiveSummary(objective: ObjectiveData, cycleEndDate: string, now = new Date()) {
  return summarizeObjective({
    ...objective,
    endDate: objective.endDate ? new Date(objective.endDate) : null,
    keyResults: objective.keyResults.map((keyResult) => executionKeyResult(keyResult, objective.endDate, cycleEndDate)),
  }, now);
}

export function getCycleSummary(cycle: OkrCycleData, now = new Date()) {
  return summarizeCycle({
    ...cycle,
    endDate: new Date(cycle.endDate),
    objectives: cycle.objectives.map((objective) => ({
      ...objective,
      endDate: objective.endDate ? new Date(objective.endDate) : null,
      keyResults: objective.keyResults.map((keyResult) => executionKeyResult(keyResult, objective.endDate, cycle.endDate)),
    })),
  }, now);
}
