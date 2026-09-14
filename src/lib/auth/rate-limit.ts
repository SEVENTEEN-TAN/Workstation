export type RateLimitResult =
  | { allowed: true; retryAfterMs: 0 }
  | { allowed: false; retryAfterMs: number };

export interface LoginRateLimiter {
  consume(key: string): RateLimitResult;
  reset(key: string): void;
}

type RateLimitOptions = {
  maxAttempts?: number;
  windowMs?: number;
  now?: () => number;
};

type AttemptWindow = {
  count: number;
  startedAt: number;
};

export class InMemoryLoginRateLimiter implements LoginRateLimiter {
  private readonly attempts = new Map<string, AttemptWindow>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: RateLimitOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 5;
    this.windowMs = options.windowMs ?? 15 * 60 * 1000;
    this.now = options.now ?? Date.now;
  }

  consume(key: string): RateLimitResult {
    const now = this.now();
    const existing = this.attempts.get(key);
    const window =
      !existing || now - existing.startedAt >= this.windowMs
        ? { count: 0, startedAt: now }
        : existing;

    if (window.count >= this.maxAttempts) {
      return {
        allowed: false,
        retryAfterMs: Math.max(0, window.startedAt + this.windowMs - now),
      };
    }

    window.count += 1;
    this.attempts.set(key, window);
    return { allowed: true, retryAfterMs: 0 };
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
