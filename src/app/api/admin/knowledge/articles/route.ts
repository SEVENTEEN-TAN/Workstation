import { z } from "zod";

import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";
import { knowledgeArticleService } from "@/lib/services/knowledge-articles";

const publishInputSchema = z.object({
  draftId: z.string().min(1).max(128),
  slug: z.string().min(3).max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      const { draftId, slug } = publishInputSchema.parse(await readJson(request));
      return Response.json(await knowledgeArticleService.publishDraft(draftId, slug), { status: 201 });
    } catch (error) {
      return jsonError(error);
    }
  });
}
