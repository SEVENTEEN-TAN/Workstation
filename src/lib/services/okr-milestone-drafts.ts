import type { Prisma } from "@prisma/client";

import { getDatabase } from "../db";
import { okrMilestoneDraftPatchSchema } from "../validators/okr-milestone-drafts";

const PROGRESS_MILESTONES = [25, 50, 75] as const;

export type OkrMilestoneDraftWrite = {
  sourceKey: string;
  kind: "KR_PROGRESS" | "KEY_RESULT_COMPLETED" | "OBJECTIVE_COMPLETED";
  occurredAt: Date;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  sourceSnapshot: Record<string, unknown>;
};

type EditableDraft = {
  id: string;
  status: string;
  titleZh?: string;
  titleEn?: string | null;
  summaryZh?: string;
  summaryEn?: string | null;
  occurredAt?: Date;
};

export type OkrMilestoneDraftRepository = {
  listDrafts(): Promise<unknown[]>;
  findDraft(id: string): Promise<EditableDraft | null>;
  updateDraft(id: string, value: Record<string, unknown>): Promise<unknown>;
  convertDraft(id: string, activity: Prisma.CareerActivityCreateInput): Promise<unknown>;
};

type ProgressMilestoneInput = {
  keyResultId: string;
  keyResultTitleZh: string;
  keyResultTitleEn: string | null;
  objectiveTitleZh: string;
  objectiveTitleEn: string | null;
  cycleNameZh: string;
  cycleNameEn: string | null;
  previousProgress: number;
  progress: number;
  noteZh: string | null;
  noteEn: string | null;
  occurredAt: Date;
};

type CompletionMilestoneInput = {
  kind: "KEY_RESULT_COMPLETED" | "OBJECTIVE_COMPLETED";
  entityId: string;
  titleZh: string;
  titleEn: string | null;
  parentZh: string;
  parentEn: string | null;
  occurredAt: Date;
};

export function selectProgressMilestone(previousProgress: number, progress: number) {
  if (progress <= previousProgress) return null;
  return PROGRESS_MILESTONES.filter((milestone) => previousProgress < milestone && progress >= milestone).at(-1) ?? null;
}

export function buildProgressMilestoneDraft(input: ProgressMilestoneInput): OkrMilestoneDraftWrite | null {
  const milestone = selectProgressMilestone(input.previousProgress, input.progress);
  if (!milestone) return null;
  const keyResultEn = input.keyResultTitleEn || input.keyResultTitleZh;
  const objectiveEn = input.objectiveTitleEn || input.objectiveTitleZh;
  const cycleEn = input.cycleNameEn || input.cycleNameZh;
  return {
    sourceKey: `KR_PROGRESS:${input.keyResultId}:${milestone}`,
    kind: "KR_PROGRESS",
    occurredAt: input.occurredAt,
    titleZh: `${input.keyResultTitleZh}达到 ${milestone}%`,
    titleEn: `${keyResultEn} reached ${milestone}%`,
    summaryZh: `在「${input.cycleNameZh} / ${input.objectiveTitleZh}」中，关键结果进度由 ${input.previousProgress}% 提升至 ${input.progress}%。${input.noteZh ? ` ${input.noteZh}` : ""}`,
    summaryEn: `In “${cycleEn} / ${objectiveEn}”, key-result progress increased from ${input.previousProgress}% to ${input.progress}%.${input.noteEn ? ` ${input.noteEn}` : ""}`,
    sourceSnapshot: { ...input, milestone },
  };
}

export function buildCompletionMilestoneDraft(input: CompletionMilestoneInput): OkrMilestoneDraftWrite {
  const objective = input.kind === "OBJECTIVE_COMPLETED";
  const titleEn = input.titleEn || input.titleZh;
  const parentEn = input.parentEn || input.parentZh;
  return {
    sourceKey: `${input.kind}:${input.entityId}`,
    kind: input.kind,
    occurredAt: input.occurredAt,
    titleZh: `${objective ? "完成目标" : "完成关键结果"}：${input.titleZh}`,
    titleEn: `${objective ? "Objective completed" : "Key result completed"}: ${titleEn}`,
    summaryZh: `在「${input.parentZh}」中完成${objective ? "目标" : "关键结果"}「${input.titleZh}」。`,
    summaryEn: `Completed ${objective ? "the objective" : "the key result"} “${titleEn}” in “${parentEn}”.`,
    sourceSnapshot: input,
  };
}

function defaultRepository(): OkrMilestoneDraftRepository {
  return {
    async listDrafts() {
      return (await getDatabase()).okrMilestoneDraft.findMany({ orderBy: { occurredAt: "desc" } });
    },
    async findDraft(id) {
      return (await getDatabase()).okrMilestoneDraft.findUnique({ where: { id } });
    },
    async updateDraft(id, value) {
      const database = await getDatabase();
      return database.$transaction(async (transaction) => {
        const draft = await transaction.okrMilestoneDraft.findUnique({ where: { id } });
        if (!draft) throw new Error("里程碑草稿不存在");
        if (draft.status !== "DRAFT") throw new Error("已转换的里程碑不能继续编辑");
        return transaction.okrMilestoneDraft.update({ where: { id }, data: value });
      });
    },
    async convertDraft(id, activity) {
      const database = await getDatabase();
      return database.$transaction(async (transaction) => {
        const draft = await transaction.okrMilestoneDraft.findUnique({ where: { id } });
        if (!draft) throw new Error("里程碑草稿不存在");
        if (draft.status !== "DRAFT") throw new Error("里程碑草稿已经转换");
        const created = await transaction.careerActivity.create({ data: activity });
        return transaction.okrMilestoneDraft.update({
          where: { id }, data: { status: "CONVERTED", convertedActivityId: created.id },
        });
      });
    },
  };
}

export function createOkrMilestoneDraftService(repository: OkrMilestoneDraftRepository = defaultRepository()) {
  return {
    list: () => repository.listDrafts(),
    async update(id: string, input: unknown) {
      const draft = await repository.findDraft(id);
      if (!draft) throw new Error("里程碑草稿不存在");
      if (draft.status !== "DRAFT") throw new Error("已转换的里程碑不能继续编辑");
      return repository.updateDraft(id, okrMilestoneDraftPatchSchema.parse(input));
    },
    async convert(id: string) {
      const draft = await repository.findDraft(id);
      if (!draft) throw new Error("里程碑草稿不存在");
      if (draft.status !== "DRAFT") throw new Error("里程碑草稿已经转换");
      if (!draft.titleZh || !draft.summaryZh || !draft.occurredAt) throw new Error("里程碑草稿内容不完整");
      return repository.convertDraft(id, {
        titleZh: draft.titleZh,
        titleEn: draft.titleEn || null,
        summaryZh: draft.summaryZh,
        summaryEn: draft.summaryEn || null,
        occurredAt: draft.occurredAt,
        visibility: "PRIVATE",
        featured: false,
        linkUrl: null,
      });
    },
  };
}

export const okrMilestoneDraftService = createOkrMilestoneDraftService();
