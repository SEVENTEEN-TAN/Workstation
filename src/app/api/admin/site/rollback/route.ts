import { getSiteContentService } from "@/lib/services/site-content";
import { jsonError, readJson } from "@/lib/services/http";
import { withAdminSession } from "@/lib/services/auth-guard";

export async function POST(request: Request) {
  return withAdminSession(async (session) => {
    try {
      const { id } = await readJson(request) as { id?: string };
      if (!id) throw new Error("缺少版本 ID");
      return Response.json(await (await getSiteContentService()).rollback(id, session!.userId));
    } catch (error) { return jsonError(error); }
  });
}
