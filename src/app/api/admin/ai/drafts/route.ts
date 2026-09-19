import { aiContentDraftService } from "@/lib/services/ai-content-drafts";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";

type DraftRequest = {
  useCase?: unknown;
  targetId?: unknown;
  objectiveId?: unknown;
};

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      const input = await readJson(request) as DraftRequest;
      if (typeof input.targetId !== "string" || !input.targetId.trim()) throw new Error("目标记录不能为空");
      if (input.useCase === "PROJECT_DESCRIPTION") {
        return Response.json(await aiContentDraftService.generateProject(input.targetId), { status: 201 });
      }
      if (input.useCase === "OKR_REVIEW") {
        const objectiveId = typeof input.objectiveId === "string" && input.objectiveId.trim() ? input.objectiveId : null;
        return Response.json(await aiContentDraftService.generateOkrReview(input.targetId, objectiveId), { status: 201 });
      }
      throw new Error("AI 草稿类型不受支持");
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
