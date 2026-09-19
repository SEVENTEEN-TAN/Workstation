import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";
import { skillCapabilityService } from "@/lib/services/skill-capabilities";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await skillCapabilityService.update((await context.params).id, await readJson(request)));
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}

export async function DELETE(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await skillCapabilityService.delete((await context.params).id));
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
