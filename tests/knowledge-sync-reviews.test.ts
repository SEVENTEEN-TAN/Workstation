import { describe, expect, it } from "vitest";

import { createKnowledgeSyncReviewService } from "../src/lib/services/knowledge-sync-reviews";

describe("knowledge sync review service", () => {
  it("records an explicit decision for a modified report item without changing content", async () => {
    const updates: Array<{ id: string; decision: string }> = [];
    const service = createKnowledgeSyncReviewService({
      async findChange(id) { return id === "change-1" ? { id, type: "MODIFIED" } : null; },
      async updateReview(id, decision) {
        updates.push({ id, decision });
        return { id, type: "MODIFIED", reviewDecision: decision, reviewedAt: new Date("2026-09-18T00:00:00.000Z") };
      },
    });

    await expect(service.review("change-1", { decision: "ACKNOWLEDGED" })).resolves.toMatchObject({
      id: "change-1",
      reviewDecision: "ACKNOWLEDGED",
    });
    expect(updates).toEqual([{ id: "change-1", decision: "ACKNOWLEDGED" }]);
  });

  it("rejects reviews for non-risk report entries", async () => {
    const service = createKnowledgeSyncReviewService({
      async findChange() { return { id: "change-1", type: "ADDED" }; },
      async updateReview() { throw new Error("must not update"); },
    });

    await expect(service.review("change-1", { decision: "IGNORED" })).rejects.toThrow("Only modified or missing changes can be reviewed");
  });
});
