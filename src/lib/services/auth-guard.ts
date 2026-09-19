import { currentSession } from "../auth/session";
import { auditLogService, type AdminAuditEntry } from "./audit-logs";

type AdminSession = NonNullable<Awaited<ReturnType<typeof currentSession>>>;

type WithAdminSessionOptions<T extends { userId: string }> = {
  loadSession?: () => Promise<T | null>;
  audit?: (entry: AdminAuditEntry) => Promise<void>;
};

export async function requireAdminSession<T>(loadSession: () => Promise<T | null> = currentSession as () => Promise<T | null>): Promise<T> {
  const session = await loadSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return session;
}

function unauthorized() {
  return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

function clientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

function auditEntry(request: Request, userId: string, statusCode: number): AdminAuditEntry {
  const url = new URL(request.url);
  const targetId = url.pathname.split("/").filter(Boolean).at(-1) ?? null;
  return {
    userId,
    method: request.method,
    path: url.pathname,
    targetId,
    statusCode,
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  };
}

async function recordAudit(
  request: Request,
  userId: string,
  statusCode: number,
  audit: (entry: AdminAuditEntry) => Promise<void>,
) {
  try {
    await audit(auditEntry(request, userId, statusCode));
  } catch (error) {
    console.error("Failed to record admin audit log", error);
  }
}

export async function withAdminSession<T extends { userId: string } = AdminSession>(
  run: (session: T) => Promise<Response>,
  request?: Request,
  options: WithAdminSessionOptions<T> = {},
) {
  const loadSession = options.loadSession ?? currentSession as () => Promise<T | null>;
  const audit = request && request.method !== "GET"
    ? options.audit ?? ((entry) => auditLogService.record(entry) as Promise<void>)
    : undefined;
  try {
    const session = await loadSession();
    if (!session) throw unauthorized();

    try {
      const response = await run(session);
      if (audit && request) await recordAudit(request, session.userId, response.status, audit);
      return response;
    } catch (error) {
      if (audit && request) {
        await recordAudit(request, session.userId, error instanceof Response ? error.status : 500, audit);
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
