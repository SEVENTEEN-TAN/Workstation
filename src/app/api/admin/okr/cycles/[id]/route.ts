import { okrService } from "@/lib/services/okr";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) { return withAdminSession(async () => { try { const cycle = await okrService.getCycle((await context.params).id); return cycle ? Response.json(cycle) : Response.json({ error: "OKR 周期不存在" }, { status: 404 }); } catch (error) { return jsonError(error); } }); }
export async function PATCH(request: Request, context: Context) { return withAdminSession(async () => { try { return Response.json(await okrService.updateCycle((await context.params).id, await readJson(request))); } catch (error) { return jsonError(error); } }, request); }
export async function DELETE(request: Request, context: Context) { return withAdminSession(async () => { try { return Response.json(await okrService.deleteCycle((await context.params).id)); } catch (error) { return jsonError(error); } }, request); }
