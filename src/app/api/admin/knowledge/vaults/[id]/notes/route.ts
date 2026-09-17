import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError } from "@/lib/services/http";
import { knowledgeVaultService } from "@/lib/services/knowledge-vaults";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      const relativePath = new URL(request.url).searchParams.get("path");
      if (!relativePath) throw new Error("Note unavailable");
      return Response.json(await knowledgeVaultService.readNote((await context.params).id, relativePath));
    } catch (error) {
      return jsonError(error);
    }
  });
}
