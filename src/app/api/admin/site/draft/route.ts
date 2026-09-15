import { getSiteContentService } from "@/lib/services/site-content";
import { jsonError, readJson } from "@/lib/services/http";
import { withAdminSession } from "@/lib/services/auth-guard";

export async function GET() {
  return withAdminSession(async (session) => Response.json(await (await getSiteContentService()).getOrCreateDraft(session!.userId)));
}

export async function PUT(request: Request) {
  return withAdminSession(async () => {
    try {
      const body = await readJson(request) as { id?: string; content?: unknown };
      if (!body.id) throw new Error("缺少草稿 ID");
      return Response.json(await (await getSiteContentService()).saveDraft(body.id, body.content));
    } catch (error) { return jsonError(error); }
  });
}
