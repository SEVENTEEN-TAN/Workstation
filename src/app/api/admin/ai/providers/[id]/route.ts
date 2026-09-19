import { withAdminSession } from "@/lib/services/auth-guard";
import { aiProviderService } from "@/lib/services/ai-providers";
import { jsonError, readJson } from "@/lib/services/http";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await aiProviderService.update((await context.params).id, await readJson(request)));
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
