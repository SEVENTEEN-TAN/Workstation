import { withAdminSession } from "@/lib/services/auth-guard";
import { experienceRecordService } from "@/lib/services/experience-records";
import { jsonError, readJson } from "@/lib/services/http";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      const id = (await context.params).id;
      return Response.json(await experienceRecordService.update(id, await readJson(request)));
    } catch (error) {
      return jsonError(error);
    }
  });
}

export async function DELETE(_request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      const id = (await context.params).id;
      return Response.json(await experienceRecordService.delete(id));
    } catch (error) {
      return jsonError(error);
    }
  });
}
