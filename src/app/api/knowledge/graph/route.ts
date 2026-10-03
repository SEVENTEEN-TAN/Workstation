import { getPublishedKnowledgeGraph } from "@/lib/services/knowledge-graph";

export async function GET() {
  return Response.json(await getPublishedKnowledgeGraph(), { headers: { "cache-control": "no-store" } });
}
