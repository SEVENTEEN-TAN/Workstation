export type MetricKeyResult = {
  mode: "METRIC";
  startValue: number;
  currentValue: number;
  targetValue: number;
};

export type ManualKeyResult = {
  mode: "MANUAL";
  manualProgress: number;
};

export type KeyResultProgressInput = MetricKeyResult | ManualKeyResult;

export type ObjectiveKeyResult = {
  progress: number;
  weight?: number;
};

const clampPercentage = (value: number) => Math.min(100, Math.max(0, value));

const roundPercentage = (value: number) => Math.round(value * 100) / 100;

export function calculateKeyResultProgress(input: KeyResultProgressInput): number {
  if (input.mode === "MANUAL") {
    return roundPercentage(clampPercentage(input.manualProgress));
  }

  const range = input.targetValue - input.startValue;
  if (range === 0) {
    return input.currentValue === input.targetValue ? 100 : 0;
  }

  const progress = ((input.currentValue - input.startValue) / range) * 100;
  return roundPercentage(clampPercentage(progress));
}

export function calculateObjectiveProgress(keyResults: ObjectiveKeyResult[]): number {
  if (keyResults.length === 0) {
    return 0;
  }

  const normalized = keyResults.map((keyResult) => ({
    progress: clampPercentage(keyResult.progress),
    weight: keyResult.weight ?? 1,
  }));
  const totalWeight = normalized.reduce((sum, keyResult) => sum + keyResult.weight, 0);

  if (totalWeight <= 0) {
    return 0;
  }

  const weightedProgress = normalized.reduce(
    (sum, keyResult) => sum + keyResult.progress * keyResult.weight,
    0,
  );

  return roundPercentage(weightedProgress / totalWeight);
}
