import { okrService } from "@/lib/services/okr";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) { return withAdminSession(async () => { try { return Response.json(await okrService.recordProgress((await context.params).id, await readJson(request))); } catch (error) { return jsonError(error); } }); }
