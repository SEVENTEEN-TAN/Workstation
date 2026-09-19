import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError } from "@/lib/services/http";
import { knowledgeVaultService } from "@/lib/services/knowledge-vaults";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await knowledgeVaultService.scan((await context.params).id));
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
