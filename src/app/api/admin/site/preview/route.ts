import { getSiteContentService } from "@/lib/services/site-content";
import { jsonError } from "@/lib/services/http";
import { withAdminSession } from "@/lib/services/auth-guard";

export async function GET(request: Request) {
  return withAdminSession(async () => {
    try {
      const id = new URL(request.url).searchParams.get("id");
      if (!id) throw new Error("缺少版本 ID");
      return Response.json(await (await getSiteContentService()).getVersion(id));
    } catch (error) { return jsonError(error); }
  });
}
