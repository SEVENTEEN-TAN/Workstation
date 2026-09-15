import {
  calculateKeyResultProgress,
  calculateObjectiveProgress,
  type KeyResultProgressInput,
} from "./progress";

type ExecutionStatus = string;

type ProgressUpdateInput = {
  recordedAt: Date;
};

export type ExecutionKeyResultInput = {
  id?: string;
  status: ExecutionStatus;
  progressMode: "METRIC" | "MANUAL";
  startValue?: number | null;
  currentValue?: number | null;
  targetValue?: number | null;
  manualProgress?: number | null;
  weight?: number | null;
  updatedAt?: Date | null;
  objectiveEndDate?: Date | null;
  cycleEndDate?: Date | null;
  progressUpdates?: ProgressUpdateInput[];
};

export type ExecutionObjectiveInput = {
  id?: string;
  status?: ExecutionStatus;
  endDate?: Date | null;
  keyResults: ExecutionKeyResultInput[];
};

export type ExecutionCycleInput = {
  id?: string;
  endDate?: Date | null;
  objectives: ExecutionObjectiveInput[];
};

export type KeyResultExecutionState = {
  progress: number;
  weight: number;
  completed: boolean;
  cancelled: boolean;
  overdue: boolean;
  stale: boolean;
  dueSoon: boolean;
  atRisk: boolean;
  lastActivityAt: Date | null;
};

export type ObjectiveExecutionSummary = {
  progress: number;
  keyResults: KeyResultExecutionState[];
  counts: {
    total: number;
    completed: number;
    overdue: number;
    stale: number;
    atRisk: number;
  };
};

export type CycleExecutionSummary = {
  progress: number;
  objectives: ObjectiveExecutionSummary[];
  counts: {
    objectives: number;
    keyResults: number;
    completed: number;
    overdue: number;
    stale: number;
    atRisk: number;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_COMPLETE_DAYS = 14;
const DUE_SOON_DAYS = 7;

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function daysFromToday(date: Date, now: Date) {
  return Math.floor((startOfUtcDay(date) - startOfUtcDay(now)) / DAY_MS);
}

function isInactiveStatus(status: ExecutionStatus) {
  return status === "COMPLETED" || status === "CANCELLED";
}

function progressInputFor(keyResult: ExecutionKeyResultInput): KeyResultProgressInput {
  if (keyResult.progressMode === "MANUAL") {
    return { mode: "MANUAL", manualProgress: keyResult.manualProgress ?? 0 };
  }

  return {
    mode: "METRIC",
    startValue: keyResult.startValue ?? 0,
    currentValue: keyResult.currentValue ?? keyResult.startValue ?? 0,
    targetValue: keyResult.targetValue ?? 0,
  };
}

function latestActivityAt(keyResult: ExecutionKeyResultInput) {
  const latestCheckIn = (keyResult.progressUpdates ?? []).reduce<Date | null>(
    (latest, update) => (!latest || update.recordedAt > latest ? update.recordedAt : latest),
    null,
  );

  return latestCheckIn ?? keyResult.updatedAt ?? null;
}

function activeDueDates(keyResult: ExecutionKeyResultInput) {
  return [keyResult.objectiveEndDate, keyResult.cycleEndDate].filter((date): date is Date => Boolean(date));
}

export function getKeyResultExecutionState(
  input: ExecutionKeyResultInput,
  now: Date,
): KeyResultExecutionState {
  const progress = calculateKeyResultProgress(progressInputFor(input));
  const completed = input.status === "COMPLETED";
  const cancelled = input.status === "CANCELLED";
  const inactive = isInactiveStatus(input.status);
  const dueDates = activeDueDates(input);
  const lastActivityAt = latestActivityAt(input);

  if (inactive) {
    return {
      progress,
      weight: input.weight ?? 1,
      completed,
      cancelled,
      overdue: false,
      stale: false,
      dueSoon: false,
      atRisk: false,
      lastActivityAt,
    };
  }

  const overdue = dueDates.some((date) => daysFromToday(date, now) < 0);
  const dueSoon = dueDates.some((date) => {
    const days = daysFromToday(date, now);
    return days >= 0 && days <= DUE_SOON_DAYS;
  });
  const stale = lastActivityAt ? daysFromToday(lastActivityAt, now) <= -STALE_COMPLETE_DAYS : false;
  const atRisk = input.status === "AT_RISK" || overdue || (dueSoon && progress < 70);

  return {
    progress,
    weight: input.weight ?? 1,
    completed,
    cancelled,
    overdue,
    stale,
    dueSoon,
    atRisk,
    lastActivityAt,
  };
}

export function summarizeObjective(
  objective: ExecutionObjectiveInput,
  now: Date,
): ObjectiveExecutionSummary {
  const keyResults = objective.keyResults.map((keyResult) =>
    getKeyResultExecutionState(
      { ...keyResult, objectiveEndDate: keyResult.objectiveEndDate ?? objective.endDate },
      now,
    ),
  );
  const progress = calculateObjectiveProgress(
    keyResults.map((keyResult) => ({ progress: keyResult.progress, weight: keyResult.weight })),
  );

  return {
    progress,
    keyResults,
    counts: {
      total: keyResults.length,
      completed: keyResults.filter((keyResult) => keyResult.completed).length,
      overdue: keyResults.filter((keyResult) => keyResult.overdue).length,
      stale: keyResults.filter((keyResult) => keyResult.stale).length,
      atRisk: keyResults.filter((keyResult) => keyResult.atRisk).length,
    },
  };
}

export function summarizeCycle(cycle: ExecutionCycleInput, now: Date): CycleExecutionSummary {
  const objectives = cycle.objectives.map((objective) =>
    summarizeObjective(
      {
        ...objective,
        keyResults: objective.keyResults.map((keyResult) => ({
          ...keyResult,
          cycleEndDate: keyResult.cycleEndDate ?? cycle.endDate,
        })),
      },
      now,
    ),
  );
  const keyResults = objectives.flatMap((objective) => objective.keyResults);
  const progress = objectives.length
    ? Math.round((objectives.reduce((sum, objective) => sum + objective.progress, 0) / objectives.length) * 100) / 100
    : 0;

  return {
    progress,
    objectives,
    counts: {
      objectives: objectives.length,
      keyResults: keyResults.length,
      completed: keyResults.filter((keyResult) => keyResult.completed).length,
      overdue: keyResults.filter((keyResult) => keyResult.overdue).length,
      stale: keyResults.filter((keyResult) => keyResult.stale).length,
      atRisk: keyResults.filter((keyResult) => keyResult.atRisk).length,
    },
  };
}
