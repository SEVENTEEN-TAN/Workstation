import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyKnowledgeSyncToken } from "../src/lib/knowledge/sync-auth";

const tokenHash = createHash("sha256").update("correct-token").digest("hex");

describe("knowledge sync authentication", () => {
  it("accepts only a matching Bearer token", () => {
    expect(verifyKnowledgeSyncToken("Bearer correct-token", tokenHash)).toBe(true);
    expect(verifyKnowledgeSyncToken("Bearer wrong-token", tokenHash)).toBe(false);
    expect(verifyKnowledgeSyncToken(null, tokenHash)).toBe(false);
  });

  it("rejects malformed configured hashes without leaking an error", () => {
    expect(verifyKnowledgeSyncToken("Bearer correct-token", "not-a-hash")).toBe(false);
  });
});
