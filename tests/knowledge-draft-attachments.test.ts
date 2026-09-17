import { describe, expect, it } from "vitest";

import { createKnowledgeDraftAttachmentService } from "../src/lib/services/knowledge-draft-attachments";

describe("knowledge draft attachments", () => {
  it("maps an embedded image to a selected image asset", async () => {
    const service = createKnowledgeDraftAttachmentService({
      async findDraft() { return { markdown: "# Note\n![[diagram.png]]" }; },
      async findImageAsset() { return { id: "asset-1" }; },
      async upsertAttachment(input) { return input; },
    });

    await expect(service.select("draft-1", "diagram.png", "asset-1")).resolves.toEqual({
      draftId: "draft-1", target: "diagram.png", assetId: "asset-1",
    });
  });

  it("rejects assets and targets that cannot become public article images", async () => {
    const service = createKnowledgeDraftAttachmentService({
      async findDraft() { return { markdown: "# Note\n![[diagram.png]]" }; },
      async findImageAsset() { return null; },
      async upsertAttachment() { throw new Error("not used"); },
    });

    await expect(service.select("draft-1", "private.txt", "asset-1")).rejects.toThrow("Attachment unavailable");
    await expect(service.select("draft-1", "diagram.png", "asset-1")).rejects.toThrow("Attachment unavailable");
  });

  it("keeps non-image embeds blocked even when an image asset is available", async () => {
    const service = createKnowledgeDraftAttachmentService({
      async findDraft() { return { markdown: "![[private-note.md]]" }; },
      async findImageAsset() { return { id: "asset-1" }; },
      async upsertAttachment() { throw new Error("not used"); },
    });

    await expect(service.select("draft-1", "private-note.md", "asset-1")).rejects.toThrow("Attachment unavailable");
  });
});
