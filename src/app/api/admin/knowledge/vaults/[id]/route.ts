import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";
import { knowledgeVaultService } from "@/lib/services/knowledge-vaults";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await knowledgeVaultService.update((await context.params).id, await readJson(request)));
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}

export async function DELETE(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await knowledgeVaultService.remove((await context.params).id));
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
