import { z } from "zod";

import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";
import { knowledgeDraftAttachmentService } from "@/lib/services/knowledge-draft-attachments";

const attachmentInputSchema = z.object({
  draftId: z.string().min(1).max(128),
  target: z.string().min(1).max(1_000),
  assetId: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      const { draftId, target, assetId } = attachmentInputSchema.parse(await readJson(request));
      return Response.json(await knowledgeDraftAttachmentService.select(draftId, target, assetId));
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
