import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError } from "@/lib/services/http";
import { readKnowledgeGraphJson } from "@/lib/knowledge/graph-contract";
import { knowledgeGraphService } from "@/lib/services/knowledge-graph";

export async function GET(request: Request) {
  return withAdminSession(async () => {
    try { return Response.json(await knowledgeGraphService.getAdmin(), { headers: { "cache-control": "no-store" } }); }
    catch (error) { return jsonError(error); }
  }, request);
}
export async function POST(request: Request) {
  return withAdminSession(async () => {
    try { return Response.json(await knowledgeGraphService.importGraph(await readKnowledgeGraphJson(request)), { status: 201 }); }
    catch (error) { return jsonError(error); }
  }, request);
}
