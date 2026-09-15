import { getAssetLibraryService, updateAssetAltText } from "@/lib/services/assets";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await updateAssetAltText((await context.params).id, await readJson(request)));
    } catch (error) {
      return jsonError(error);
    }
  });
}

export async function DELETE(_request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await (await getAssetLibraryService()).delete((await context.params).id));
    } catch (error) {
      return jsonError(error);
    }
  });
}
