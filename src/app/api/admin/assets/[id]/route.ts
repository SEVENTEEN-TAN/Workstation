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
  }, request);
}

export async function PUT(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("请选择图片文件");
      return Response.json(await (await getAssetLibraryService()).replace((await context.params).id, file));
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}

export async function DELETE(request: Request, context: Context) {
  return withAdminSession(async () => {
    try {
      return Response.json(await (await getAssetLibraryService()).delete((await context.params).id));
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
