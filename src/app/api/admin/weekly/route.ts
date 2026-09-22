import { weeklyActivityDraftService } from "@/lib/services/weekly-activity-drafts";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";

export async function GET() {
  return withAdminSession(async () => Response.json(await weeklyActivityDraftService.list()));
}

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      const result = await weeklyActivityDraftService.generate(await readJson(request));
      return Response.json(result, { status: result.created ? 201 : 200 });
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
