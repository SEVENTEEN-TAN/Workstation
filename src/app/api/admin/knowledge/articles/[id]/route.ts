import { knowledgeArticleService } from "@/lib/services/knowledge-articles";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError } from "@/lib/services/http";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await knowledgeArticleService.unpublish((await context.params).id));
    } catch (error) {
      return jsonError(error);
    }
  });
}
