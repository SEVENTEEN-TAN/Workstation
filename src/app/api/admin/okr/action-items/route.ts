import { okrService } from "@/lib/services/okr";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      return Response.json(await okrService.createActionItem(await readJson(request)), { status: 201 });
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
