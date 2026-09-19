import type { Prisma } from "@prisma/client";

import { getDatabase } from "../db";
import {
  okrReviewDraftSchema,
  projectDescriptionDraftSchema,
  type OkrReviewDraft,
  type ProjectDescriptionDraft,
} from "../validators/ai-content-drafts";
import { aiGenerationService, type AiGenerator } from "./ai-generation";

type DraftRecord = {
  id: string;
  useCase: string;
  targetType: string;
  targetId: string;
  status: string;
  sourceSnapshot?: unknown;
  content: unknown;
};

type DraftWrite = {
  useCase: string;
  targetType: string;
  targetId: string;
  sourceSnapshot: unknown;
  content: unknown;
  providerId: string;
  model: string;
};

type ProjectSource = Record<string, unknown>;
type OkrObjectiveSource = { id: string } & Record<string, unknown>;
type OkrCycleSource = { objectives: OkrObjectiveSource[] } & Record<string, unknown>;

export type AiContentDraftRepository = {
  listDrafts(useCase?: string, targetId?: string): Promise<unknown[]>;
  findProject(id: string): Promise<ProjectSource | null>;
  findCycle(id: string): Promise<OkrCycleSource | null>;
  createDraft(value: DraftWrite): Promise<unknown>;
  findDraft(id: string): Promise<DraftRecord | null>;
  applyProjectDraft(id: string, targetId: string, content: ProjectDescriptionDraft): Promise<unknown>;
  applyOkrReviewDraft(id: string, targetId: string, content: OkrReviewDraft, objectiveId?: string | null): Promise<unknown>;
  discardDraft(id: string): Promise<unknown>;
};

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function defaultRepository(): AiContentDraftRepository {
  return {
    listDrafts(useCase, targetId) {
      return getDatabase().then((database) => database.aiContentDraft.findMany({
        where: { status: "DRAFT", ...(useCase ? { useCase } : {}), ...(targetId ? { targetId } : {}) },
        orderBy: { generatedAt: "desc" },
      }));
    },
    findProject(id) {
      return getDatabase().then(async (database) => {
        const project = await database.portfolioProject.findUnique({ where: { id } });
        return project ? { ...project } : null;
      });
    },
    findCycle(id) {
      return getDatabase().then(async (database) => {
        const cycle = await database.okrCycle.findUnique({
          where: { id },
          include: {
            objectives: {
              orderBy: { sortOrder: "asc" },
              include: {
                keyResults: {
                  orderBy: { sortOrder: "asc" },
                  include: {
                    progressUpdates: { orderBy: { recordedAt: "desc" }, take: 10 },
                    actionItems: { orderBy: { sortOrder: "asc" } },
                  },
                },
              },
            },
          },
        });
        return cycle ? { ...cycle, objectives: cycle.objectives.map((objective) => ({ ...objective })) } : null;
      });
    },
    createDraft(value) {
      return getDatabase().then((database) => database.aiContentDraft.create({
        data: { ...value, sourceSnapshot: json(value.sourceSnapshot), content: json(value.content) },
      }));
    },
    findDraft(id) {
      return getDatabase().then((database) => database.aiContentDraft.findUnique({ where: { id } }));
    },
    applyProjectDraft(id, targetId, content) {
      return getDatabase().then((database) => database.$transaction(async (transaction) => {
        await transaction.portfolioProject.update({ where: { id: targetId }, data: content });
        return transaction.aiContentDraft.update({ where: { id }, data: { status: "APPLIED", appliedAt: new Date() } });
      }));
    },
    applyOkrReviewDraft(id, targetId, content, objectiveId) {
      return getDatabase().then((database) => database.$transaction(async (transaction) => {
        await transaction.review.create({
          data: {
            cycleId: targetId,
            objectiveId: objectiveId ?? null,
            ...content,
            visibility: "PRIVATE",
            reviewedAt: new Date(),
          },
        });
        return transaction.aiContentDraft.update({ where: { id }, data: { status: "APPLIED", appliedAt: new Date() } });
      }));
    },
    discardDraft(id) {
      return getDatabase().then((database) => database.aiContentDraft.update({
        where: { id }, data: { status: "DISCARDED" },
      }));
    },
  };
}

function projectPrompt(source: unknown) {
  return `请根据以下项目事实整理双语项目说明。只返回 JSON，不要 Markdown。字段必须为 summaryZh, summaryEn, contextZh, contextEn, responsibilityZh, responsibilityEn, challengeZh, challengeEn, approachZh, approachEn, resultZh, resultEn。不得虚构事实。\n\nSOURCE:\n${JSON.stringify(source)}`;
}

function okrPrompt(source: unknown) {
  return `请根据以下 OKR 周期事实生成双语复盘草稿。只返回 JSON，不要 Markdown。字段必须为 achievementsZh, achievementsEn, problemsZh, problemsEn, lessonsZh, lessonsEn, nextActionsZh, nextActionsEn, score。不得虚构事实，无法判断的问题要明确说明。\n\nSOURCE:\n${JSON.stringify(source)}`;
}

function objectiveIdFromSnapshot(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const objectiveId = Reflect.get(value, "objectiveId");
  return typeof objectiveId === "string" && objectiveId.length > 0 ? objectiveId : null;
}

export function createAiContentDraftService(
  repository: AiContentDraftRepository = defaultRepository(),
  generator: AiGenerator = aiGenerationService,
) {
  const draftActions = new Map<string, Promise<unknown>>();

  function runDraftAction<T>(id: string, action: () => Promise<T>): Promise<T> {
    const previous = draftActions.get(id) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(action);
    draftActions.set(id, result);
    void result.then(() => undefined, () => undefined).then(() => {
      if (draftActions.get(id) === result) draftActions.delete(id);
    });
    return result;
  }

  return {
    list: (useCase?: string, targetId?: string) => repository.listDrafts(useCase, targetId),
    async generateProject(projectId: string) {
      const sourceSnapshot = await repository.findProject(projectId);
      if (!sourceSnapshot) throw new Error("项目不存在");
      const generated = await generator.generate("PROJECT_DESCRIPTION", {
        system: "You turn verified project facts into concise bilingual portfolio copy.",
        prompt: projectPrompt(sourceSnapshot),
        schema: projectDescriptionDraftSchema,
      });
      return repository.createDraft({
        useCase: "PROJECT_DESCRIPTION", targetType: "PORTFOLIO_PROJECT", targetId: projectId,
        sourceSnapshot, content: generated.content, providerId: generated.providerId, model: generated.model,
      });
    },
    async generateOkrReview(cycleId: string, objectiveId?: string | null) {
      const cycle = await repository.findCycle(cycleId);
      if (!cycle) throw new Error("OKR 周期不存在");
      let sourceSnapshot: OkrCycleSource = cycle;
      if (objectiveId) {
        const objective = cycle.objectives.find((item) => item.id === objectiveId);
        if (!objective) throw new Error("Objective 不属于该周期");
        sourceSnapshot = { ...cycle, objectiveId, objectives: [objective] };
      }
      const generated = await generator.generate("OKR_REVIEW", {
        system: "You create evidence-based bilingual OKR review drafts.",
        prompt: okrPrompt(sourceSnapshot),
        schema: okrReviewDraftSchema,
      });
      return repository.createDraft({
        useCase: "OKR_REVIEW", targetType: "OKR_CYCLE", targetId: cycleId,
        sourceSnapshot, content: generated.content, providerId: generated.providerId, model: generated.model,
      });
    },
    apply: (id: string) => runDraftAction(id, async () => {
      const draft = await repository.findDraft(id);
      if (!draft) throw new Error("AI 草稿不存在");
      if (draft.status !== "DRAFT") throw new Error("AI 草稿已经处理");
      if (draft.useCase === "PROJECT_DESCRIPTION" && draft.targetType === "PORTFOLIO_PROJECT") {
        return repository.applyProjectDraft(id, draft.targetId, projectDescriptionDraftSchema.parse(draft.content));
      }
      if (draft.useCase === "OKR_REVIEW" && draft.targetType === "OKR_CYCLE") {
        return repository.applyOkrReviewDraft(
          id,
          draft.targetId,
          okrReviewDraftSchema.parse(draft.content),
          objectiveIdFromSnapshot(draft.sourceSnapshot),
        );
      }
      throw new Error("AI 草稿类型不受支持");
    }),
    discard: (id: string) => runDraftAction(id, async () => {
      const draft = await repository.findDraft(id);
      if (!draft) throw new Error("AI 草稿不存在");
      if (draft.status !== "DRAFT") throw new Error("AI 草稿已经处理");
      return repository.discardDraft(id);
    }),
  };
}

export const aiContentDraftService = createAiContentDraftService();
