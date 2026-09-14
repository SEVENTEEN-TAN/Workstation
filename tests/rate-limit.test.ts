import { describe, expect, it } from "vitest";

import { InMemoryLoginRateLimiter } from "../src/lib/auth/rate-limit";

describe("InMemoryLoginRateLimiter", () => {
  it("blocks attempts beyond the configured limit until the window resets", () => {
    let now = 1_000;
    const limiter = new InMemoryLoginRateLimiter({
      maxAttempts: 2,
      windowMs: 500,
      now: () => now,
    });

    expect(limiter.consume("client").allowed).toBe(true);
    expect(limiter.consume("client").allowed).toBe(true);
    const blocked = limiter.consume("client");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(500);

    now = 1_500;
    expect(limiter.consume("client").allowed).toBe(true);
  });

  it("can clear a client's attempts after successful authentication", () => {
    const limiter = new InMemoryLoginRateLimiter({ maxAttempts: 1, windowMs: 1_000 });
    limiter.consume("client");
    expect(limiter.consume("client").allowed).toBe(false);
    limiter.reset("client");
    expect(limiter.consume("client").allowed).toBe(true);
  });
});
