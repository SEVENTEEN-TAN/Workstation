import { verifyKnowledgeSyncToken } from "@/lib/knowledge/sync-auth";
import { knowledgeAttachmentTransferService } from "@/lib/services/knowledge-attachment-transfers";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifyKnowledgeSyncToken(request.headers.get("authorization"), process.env.KNOWLEDGE_SYNC_TOKEN_HASH)) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return Response.json({ requests: await knowledgeAttachmentTransferService.listPending((await context.params).id) });
}
