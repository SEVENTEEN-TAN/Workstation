import { z } from "zod";

import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";
import { knowledgePublicationService } from "@/lib/services/knowledge-publications";

const draftInputSchema = z.object({ sourceRevisionId: z.string().min(1).max(128) });

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      const { sourceRevisionId } = draftInputSchema.parse(await readJson(request));
      return Response.json(await knowledgePublicationService.createDraft(sourceRevisionId), { status: 201 });
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
