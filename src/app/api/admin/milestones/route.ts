import { okrMilestoneDraftService } from "@/lib/services/okr-milestone-drafts";
import { withAdminSession } from "@/lib/services/auth-guard";

export async function GET() {
  return withAdminSession(async () => Response.json(await okrMilestoneDraftService.list()));
}
