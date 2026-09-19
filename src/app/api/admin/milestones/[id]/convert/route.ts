import { okrMilestoneDraftService } from "@/lib/services/okr-milestone-drafts";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError } from "@/lib/services/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await okrMilestoneDraftService.convert((await context.params).id));
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
