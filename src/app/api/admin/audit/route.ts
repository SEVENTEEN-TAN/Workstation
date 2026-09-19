import { withAdminSession } from "@/lib/services/auth-guard";
import { auditLogService } from "@/lib/services/audit-logs";

export async function GET() {
  return withAdminSession(async () => Response.json(await auditLogService.list()));
}
