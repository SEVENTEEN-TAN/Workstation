import { withAdminSession } from "@/lib/services/auth-guard";
import { aiProviderService } from "@/lib/services/ai-providers";
import { jsonError, readJson } from "@/lib/services/http";

export async function GET() {
  return withAdminSession(async () => {
    try {
      return Response.json(await aiProviderService.listState());
    } catch (error) {
      return jsonError(error);
    }
  });
}

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      return Response.json(await aiProviderService.save(await readJson(request)), { status: 201 });
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
