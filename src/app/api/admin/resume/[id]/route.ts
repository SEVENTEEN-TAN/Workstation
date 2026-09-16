import { getResumeFileService } from "@/lib/services/resume-files";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      const input = await readJson(request) as { visibility?: unknown };
      return Response.json(await (await getResumeFileService()).setVisibility((await context.params).id, input.visibility));
    } catch (error) {
      return jsonError(error);
    }
  });
}

export async function DELETE(_request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await (await getResumeFileService()).delete((await context.params).id));
    } catch (error) {
      return jsonError(error);
    }
  });
}
