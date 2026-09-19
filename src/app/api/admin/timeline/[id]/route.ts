import { careerTimelineDraftService } from "@/lib/services/career-timeline-drafts";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await careerTimelineDraftService.update((await context.params).id, await readJson(request)));
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
