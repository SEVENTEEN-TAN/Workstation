import { careerTimelineDraftService } from "@/lib/services/career-timeline-drafts";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError } from "@/lib/services/http";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await careerTimelineDraftService.convert((await context.params).id));
    } catch (error) {
      return jsonError(error);
    }
  });
}
