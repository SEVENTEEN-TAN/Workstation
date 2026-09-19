import { describe, expect, it, vi } from "vitest";

import { createAiContentDraftService, type AiContentDraftRepository } from "../src/lib/services/ai-content-drafts";

const generatedProject = {
  summaryZh: "中文摘要", summaryEn: "English summary",
  contextZh: "中文背景", contextEn: "English context",
  responsibilityZh: "中文职责", responsibilityEn: "English responsibility",
  challengeZh: "中文挑战", challengeEn: "English challenge",
  approachZh: "中文方案", approachEn: "English approach",
  resultZh: "中文结果", resultEn: "English result",
};

function repository(): AiContentDraftRepository & { created: unknown[]; applied: unknown[] } {
  const created: unknown[] = [];
  const applied: unknown[] = [];
  const project = {
    id: "project-1", titleZh: "个人工作站", titleEn: "Personal Workstation",
    ...generatedProject, technologies: ["Next.js"], links: [], visibility: "PRIVATE",
  };
  const cycle = {
    id: "cycle-1", nameZh: "2026 Q3", nameEn: "2026 Q3", status: "COMPLETED",
    startDate: new Date("2026-07-01"), endDate: new Date("2026-09-30"),
    objectives: [{ id: "objective-1", titleZh: "发布工作站", titleEn: "Ship workstation", status: "COMPLETED", keyResults: [] }],
  };
  return {
    created, applied,
    async listDrafts() { return []; },
    async findProject() { return project as never; },
    async findCycle() { return cycle as never; },
    async createDraft(value) { created.push(value); return { id: "draft-1", status: "DRAFT", ...value }; },
    async findDraft() { return null; },
    async applyProjectDraft(id, targetId, content) { applied.push({ id, targetId, content }); return { id, status: "APPLIED" }; },
    async applyOkrReviewDraft(id, targetId, content) { applied.push({ id, targetId, content }); return { id, status: "APPLIED" }; },
    async discardDraft(id) { return { id, status: "DISCARDED" }; },
  };
}

describe("AI content drafts", () => {
  it("stores a project description as a private draft with its source snapshot", async () => {
    const repo = repository();
    const generate = vi.fn(async () => ({ content: generatedProject, providerId: "provider-1", model: "model-1" }));
    const service = createAiContentDraftService(repo, { generate });

    await expect(service.generateProject("project-1")).resolves.toMatchObject({ status: "DRAFT", targetId: "project-1" });
    expect(repo.created[0]).toMatchObject({
      useCase: "PROJECT_DESCRIPTION", targetType: "PORTFOLIO_PROJECT", targetId: "project-1",
      sourceSnapshot: expect.objectContaining({ titleZh: "个人工作站" }), content: generatedProject,
    });
  });

  it("creates an OKR review draft without writing a Review", async () => {
    const repo = repository();
    const content = {
      achievementsZh: "完成", achievementsEn: "Done", problemsZh: "问题", problemsEn: "Problem",
      lessonsZh: "经验", lessonsEn: "Lesson", nextActionsZh: "下一步", nextActionsEn: "Next", score: 8,
    };
    const generate = vi.fn(async () => ({ content, providerId: "provider-1", model: "model-1" }));
    const service = createAiContentDraftService(repo, { generate });

    await service.generateOkrReview("cycle-1");
    expect(repo.created[0]).toMatchObject({
      useCase: "OKR_REVIEW", targetType: "OKR_CYCLE", targetId: "cycle-1", content,
      sourceSnapshot: expect.objectContaining({ nameZh: "2026 Q3" }),
    });
    expect(repo.applied).toEqual([]);
  });

  it("limits an objective review draft to the selected objective", async () => {
    const repo = repository();
    repo.findCycle = vi.fn(async () => ({
      id: "cycle-1",
      nameZh: "2026 Q3",
      objectives: [
        { id: "objective-1", titleZh: "发布工作站", keyResults: [] },
        { id: "objective-2", titleZh: "不应发送", keyResults: [] },
      ],
    }) as never);
    const generate = vi.fn(async () => ({
      content: {
        achievementsZh: "完成", achievementsEn: "Done", problemsZh: "问题", problemsEn: "Problem",
        lessonsZh: "经验", lessonsEn: "Lesson", nextActionsZh: "下一步", nextActionsEn: "Next", score: 8,
      },
      providerId: "provider-1",
      model: "model-1",
    }));
    const service = createAiContentDraftService(repo, { generate });

    await service.generateOkrReview("cycle-1", "objective-1");

    expect(generate).toHaveBeenCalledWith("OKR_REVIEW", expect.objectContaining({
      prompt: expect.stringContaining("发布工作站"),
    }));
    expect(generate.mock.calls[0]?.[1].prompt).not.toContain("不应发送");
    expect(repo.created[0]).toMatchObject({
      sourceSnapshot: expect.objectContaining({
        objectiveId: "objective-1",
        objectives: [{ id: "objective-1", titleZh: "发布工作站", keyResults: [] }],
      }),
    });
  });

  it("rejects an objective review when the objective is outside the cycle", async () => {
    const repo = repository();
    const generate = vi.fn();
    const service = createAiContentDraftService(repo, { generate });

    await expect(service.generateOkrReview("cycle-1", "objective-missing"))
      .rejects.toThrow("Objective 不属于该周期");
    expect(generate).not.toHaveBeenCalled();
  });

  it("applies only open drafts through the matching explicit transaction", async () => {
    const repo = repository();
    repo.findDraft = vi.fn(async () => ({
      id: "draft-1", useCase: "PROJECT_DESCRIPTION", targetType: "PORTFOLIO_PROJECT",
      targetId: "project-1", status: "DRAFT", content: generatedProject,
    }) as never);
    const service = createAiContentDraftService(repo, { generate: vi.fn() });

    await service.apply("draft-1");
    expect(repo.applied).toEqual([{ id: "draft-1", targetId: "project-1", content: generatedProject }]);
  });

  it("lets only one concurrent action win for the same draft", async () => {
    const draft = {
      id: "draft-1", useCase: "PROJECT_DESCRIPTION", targetType: "PORTFOLIO_PROJECT",
      targetId: "project-1", status: "DRAFT", content: generatedProject,
    };
    const state = { status: "DRAFT", projectUpdated: false };
    const repo = repository();
    repo.findDraft = vi.fn(async () => ({ ...draft, status: state.status }) as never);
    repo.applyProjectDraft = vi.fn(async () => {
      state.status = "APPLIED";
      state.projectUpdated = true;
      return { id: "draft-1", status: "APPLIED" };
    });
    repo.discardDraft = vi.fn(async () => {
      state.status = "DISCARDED";
      return { id: "draft-1", status: "DISCARDED" };
    });
    const service = createAiContentDraftService(repo, { generate: vi.fn() });

    const results = await Promise.allSettled([
      service.apply("draft-1"),
      service.discard("draft-1"),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(state).toEqual(
      state.status === "APPLIED"
        ? { status: "APPLIED", projectUpdated: true }
        : { status: "DISCARDED", projectUpdated: false },
    );
  });
});
