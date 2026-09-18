import { withAdminSession } from "@/lib/services/auth-guard";
import { aiProviderService } from "@/lib/services/ai-providers";
import { jsonError } from "@/lib/services/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json({ models: await aiProviderService.refreshModels((await context.params).id) });
    } catch (error) {
      return jsonError(error);
    }
  });
}
