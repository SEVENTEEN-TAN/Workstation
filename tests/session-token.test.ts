import { describe, expect, it } from "vitest";

import { createSessionToken, hashSessionToken } from "../src/lib/auth/session-token";

describe("session tokens", () => {
  it("returns a random raw token while exposing only its SHA-256 hash for storage", () => {
    const first = createSessionToken();
    const second = createSessionToken();

    expect(first.token).not.toBe(second.token);
    expect(first.token).not.toBe(first.tokenHash);
    expect(first.tokenHash).toBe(hashSessionToken(first.token));
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
