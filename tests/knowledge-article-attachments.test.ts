import { describe, expect, it } from "vitest";

import { createKnowledgeArticleAttachmentReader } from "../src/lib/services/knowledge-article-attachments";

describe("public knowledge article attachments", () => {
  it("serves only a stored article snapshot with immutable caching", async () => {
    const reader = createKnowledgeArticleAttachmentReader({
      async findAttachment(id) { return id === "snapshot-1" ? { storagePath: "C:/snapshots/article-1/snapshot-1", mimeType: "image/png", sha256: "hash-1" } : null; },
    }, async () => new Uint8Array([1, 2, 3]));

    const response = await reader.get("snapshot-1", null);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("immutable");
    await expect(response.bytes()).resolves.toEqual(new Uint8Array([1, 2, 3]));
  });
});
