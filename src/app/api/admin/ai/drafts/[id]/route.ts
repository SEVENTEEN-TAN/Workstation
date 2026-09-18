import { aiContentDraftService } from "@/lib/services/ai-content-drafts";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError } from "@/lib/services/http";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await aiContentDraftService.discard((await context.params).id));
    } catch (error) {
      return jsonError(error);
    }
  });
}
