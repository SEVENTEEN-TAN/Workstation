import { withAdminSession } from "@/lib/services/auth-guard";
import { configureGitHubSync, getGitHubSyncState } from "@/lib/services/github-sync";
import { jsonError, readJson } from "@/lib/services/http";

export async function GET() { return withAdminSession(async () => Response.json(await getGitHubSyncState())); }
export async function PUT(request: Request) {
  return withAdminSession(async () => {
    try { return Response.json(await configureGitHubSync(await readJson(request))); }
    catch (error) { return jsonError(error); }
  });
}
