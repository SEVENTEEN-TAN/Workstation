import { careerTimelineDraftService } from "@/lib/services/career-timeline-drafts";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError } from "@/lib/services/http";

export async function GET() {
  return withAdminSession(async () => Response.json(await careerTimelineDraftService.list()));
}

export async function POST() {
  return withAdminSession(async () => {
    try {
      return Response.json(await careerTimelineDraftService.sync());
    } catch (error) {
      return jsonError(error);
    }
  });
}
