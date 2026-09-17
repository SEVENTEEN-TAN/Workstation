import { verifyKnowledgeSyncToken } from "@/lib/knowledge/sync-auth";
import { knowledgeAttachmentTransferService } from "@/lib/services/knowledge-attachment-transfers";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifyKnowledgeSyncToken(request.headers.get("authorization"), process.env.KNOWLEDGE_SYNC_TOKEN_HASH)) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > 9 * 1024 * 1024) return new Response(null, { status: 413 });
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new Error("Invalid attachment");
    return Response.json(await knowledgeAttachmentTransferService.upload((await context.params).id, file));
  } catch {
    return Response.json({ error: "ATTACHMENT_UPLOAD_FAILED" }, { status: 400 });
  }
}
