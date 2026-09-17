import { describe, expect, it } from "vitest";

import { createKnowledgeAttachmentTransferService } from "../src/lib/services/knowledge-attachment-transfers";

describe("knowledge attachment transfers", () => {
  it("stores a pending image and maps it to the publication draft", async () => {
    const completed: string[] = [];
    const service = createKnowledgeAttachmentTransferService({
      async listPending() { return []; },
      async findRequest() { return { id: "request-1", draftId: "draft-1", target: "diagram.png", status: "PENDING", assetId: null }; },
      async complete(_request, assetId) { completed.push(assetId); return { id: "request-1", status: "UPLOADED", assetId }; },
      async removeAsset() { throw new Error("must not remove"); },
    }, async () => ({ id: "asset-1", storagePath: "uploads/asset-1.png" }));

    await expect(service.upload("request-1", new File(["image"], "diagram.png", { type: "image/png" })))
      .resolves.toMatchObject({ status: "UPLOADED", assetId: "asset-1" });
    expect(completed).toEqual(["asset-1"]);
  });

  it("returns an existing mapping when an upload is retried", async () => {
    const service = createKnowledgeAttachmentTransferService({
      async listPending() { return []; },
      async findRequest() { return { id: "request-1", draftId: "draft-1", target: "diagram.png", status: "UPLOADED", assetId: "asset-1" }; },
      async complete() { throw new Error("must not complete twice"); },
      async removeAsset() { throw new Error("must not remove"); },
    }, async () => { throw new Error("must not store twice"); });

    await expect(service.upload("request-1", new File([], "diagram.png")))
      .resolves.toEqual({ id: "request-1", status: "UPLOADED", assetId: "asset-1" });
  });
});
