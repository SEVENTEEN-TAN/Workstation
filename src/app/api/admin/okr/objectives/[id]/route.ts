import { okrService } from "@/lib/services/okr";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return withAdminSession(async () => { try { const objective = await okrService.getObjective((await context.params).id, new URL(request.url).searchParams.get("cycleId") ?? undefined); return objective ? Response.json(objective) : Response.json({ error: "Objective 不存在" }, { status: 404 }); } catch (error) { return jsonError(error); } }); }
export async function PATCH(request: Request, context: Context) { return withAdminSession(async () => { try { return Response.json(await okrService.updateObjective((await context.params).id, await readJson(request))); } catch (error) { return jsonError(error); } }); }
export async function DELETE(_request: Request, context: Context) { return withAdminSession(async () => { try { return Response.json(await okrService.deleteObjective((await context.params).id)); } catch (error) { return jsonError(error); } }); }
