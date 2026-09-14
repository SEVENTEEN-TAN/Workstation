import { currentSession } from "../auth/session";

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

export async function withAdminSession(run: (session: Awaited<ReturnType<typeof currentSession>>) => Promise<Response>) {
  try {
    const session = await requireAdminSession(currentSession);
    return await run(session);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }
}
