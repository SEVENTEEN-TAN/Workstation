import { getAssetLibraryService, saveImageAsset } from "@/lib/services/assets";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError } from "@/lib/services/http";

export async function GET() {
  return withAdminSession(async () => Response.json(await (await getAssetLibraryService()).list()));
}

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("请选择图片文件");
      const asset = await saveImageAsset(file, String(form.get("altTextZh") ?? ""), String(form.get("altTextEn") ?? ""));
      return Response.json({ ...asset, url: `/api/assets/${asset.id}` }, { status: 201 });
    } catch (error) { return jsonError(error); }
  });
}
