import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError } from "@/lib/services/http";
import { readKnowledgeGraphJson } from "@/lib/knowledge/graph-contract";
import { knowledgeGraphService } from "@/lib/services/knowledge-graph";

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try { return Response.json(await knowledgeGraphService.publish(await readKnowledgeGraphJson(request))); }
    catch (error) { return jsonError(error); }
  }, request);
}
