import { login } from "@/lib/auth/session";
import { z } from "zod";

const loginSchema = z.object({ username: z.string().trim().min(1), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const clientKey = `${forwarded ?? "local"}:${input.username.toLowerCase()}`;
    const result = await login({ ...input, clientKey, ipAddress: forwarded, userAgent: request.headers.get("user-agent") ?? undefined });
    if (!result.ok) {
      return Response.json(result, {
        status: result.error === "RATE_LIMITED" ? 429 : 401,
        headers: result.retryAfterMs ? { "retry-after": String(Math.ceil(result.retryAfterMs / 1000)) } : undefined,
      });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
}
