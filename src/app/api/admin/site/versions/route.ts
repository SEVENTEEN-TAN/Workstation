import { getSiteContentService } from "@/lib/services/site-content";
import { withAdminSession } from "@/lib/services/auth-guard";

export async function GET() {
  return withAdminSession(async () => Response.json(await (await getSiteContentService()).listVersions()));
}
