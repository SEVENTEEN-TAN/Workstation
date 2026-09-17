import { z } from "zod";

import { getDatabase } from "../db";

type KnowledgeSyncReviewRepository = {
  findChange(id: string): Promise<{ id: string; type: string } | null>;
  updateReview(id: string, decision: "ACKNOWLEDGED" | "IGNORED"): Promise<unknown>;
};

const reviewInputSchema = z.object({
  decision: z.enum(["ACKNOWLEDGED", "IGNORED"]),
});

function defaultRepository(): KnowledgeSyncReviewRepository {
  return {
    async findChange(id) {
      return (await getDatabase()).knowledgeSyncChange.findUnique({
        where: { id },
        select: { id: true, type: true },
      });
    },
    async updateReview(id, decision) {
      return (await getDatabase()).knowledgeSyncChange.update({
        where: { id },
        data: { reviewDecision: decision, reviewedAt: new Date() },
      });
    },
  };
}

export function createKnowledgeSyncReviewService(repository: KnowledgeSyncReviewRepository = defaultRepository()) {
  return {
    async review(id: string, input: unknown) {
      const change = await repository.findChange(id);
      if (!change) throw new Error("Knowledge sync change not found");
      if (change.type !== "MODIFIED" && change.type !== "MISSING") {
        throw new Error("Only modified or missing changes can be reviewed");
      }
      return repository.updateReview(id, reviewInputSchema.parse(input).decision);
    },
  };
}

export const knowledgeSyncReviewService = createKnowledgeSyncReviewService();
