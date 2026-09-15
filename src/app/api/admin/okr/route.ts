import { okrService } from "@/lib/services/okr";
import { withAdminSession } from "@/lib/services/auth-guard";

export async function GET() {
  return withAdminSession(async () => Response.json(await okrService.listAll()));
}
