import { OverviewWorkspace } from "@/components/admin/OverviewWorkspace";
import { auditLogService } from "@/lib/services/audit-logs";
import { okrService } from "@/lib/services/okr";

export default async function AdminOverviewPage() {
  const [dashboardResult, auditLogResult] = await Promise.all([
    okrService.getDashboard(),
    auditLogService.list(10),
  ]);
  return <OverviewWorkspace initialDashboard={dashboardResult} initialAuditLogs={auditLogResult} />;
}
