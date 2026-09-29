import { getOverviewQueue } from "@/lib/services/overview-queue";
import { withAdminSession } from "@/lib/services/auth-guard";

export async function GET() {
  return withAdminSession(async () => Response.json(await getOverviewQueue()));
}
