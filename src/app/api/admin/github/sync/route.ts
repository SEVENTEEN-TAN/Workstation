import { withAdminSession } from "@/lib/services/auth-guard";
import { syncGitHub } from "@/lib/services/github-sync";
import { jsonError } from "@/lib/services/http";

export async function POST() {
  return withAdminSession(async () => {
    try { return Response.json(await syncGitHub()); }
    catch (error) { return jsonError(error); }
  });
}
