import { logout } from "@/lib/auth/session";

export async function POST() {
  await logout();
  return Response.json({ ok: true });
}
