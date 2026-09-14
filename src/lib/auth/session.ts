import { cookies } from "next/headers";

import { getDatabase } from "../db";
import { verifyPassword } from "./password";
import { InMemoryLoginRateLimiter, type LoginRateLimiter } from "./rate-limit";
import { createSessionToken, hashSessionToken } from "./session-token";

export const SESSION_COOKIE_NAME = "workstation_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const loginRateLimiter = new InMemoryLoginRateLimiter();

type LoginInput = {
  username: string;
  password: string;
  clientKey: string;
  ipAddress?: string;
  userAgent?: string;
};

export type LoginResult =
  | { ok: true }
  | { ok: false; error: "INVALID_CREDENTIALS" | "RATE_LIMITED"; retryAfterMs?: number };

export async function login(
  input: LoginInput,
  limiter: LoginRateLimiter = loginRateLimiter,
): Promise<LoginResult> {
  const rateLimit = limiter.consume(input.clientKey);
  if (!rateLimit.allowed) {
    return { ok: false, error: "RATE_LIMITED", retryAfterMs: rateLimit.retryAfterMs };
  }

  const database = await getDatabase();
  const user = await database.user.findUnique({ where: { username: input.username } });
  if (!user?.isActive || !(await verifyPassword(user.passwordHash, input.password))) {
    return { ok: false, error: "INVALID_CREDENTIALS" };
  }

  const { token, tokenHash } = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await database.$transaction([
    database.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    }),
    database.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  limiter.reset(input.clientKey);

  return { ok: true };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const database = await getDatabase();
    await database.session.updateMany({
      where: { tokenHash: hashSessionToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function currentSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const database = await getDatabase();
  return database.session.findFirst({
    where: {
      tokenHash: hashSessionToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      user: { isActive: true },
    },
    include: { user: true },
  });
}
