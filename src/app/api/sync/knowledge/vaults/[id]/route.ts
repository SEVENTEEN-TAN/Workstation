import { knowledgeSyncPayloadSchema } from "@/lib/knowledge/sync-payload";
import { verifyKnowledgeSyncToken } from "@/lib/knowledge/sync-auth";
import { knowledgeVaultService } from "@/lib/services/knowledge-vaults";

const MAX_BODY_BYTES = 4 * 1024 * 1024;

function unauthorized() {
  return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

async function readTransportBody(request: Request) {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new Response(null, { status: 413 });
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) throw new Response(null, { status: 413 });
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Invalid sync request");
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifyKnowledgeSyncToken(request.headers.get("authorization"), process.env.KNOWLEDGE_SYNC_TOKEN_HASH)) return unauthorized();
  try {
    const payload = knowledgeSyncPayloadSchema.parse(await readTransportBody(request));
    const summary = await knowledgeVaultService.receiveTransportSync((await context.params).id, payload);
    return Response.json({ summary });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ error: "SYNC_FAILED" }, { status: 400 });
  }
}
