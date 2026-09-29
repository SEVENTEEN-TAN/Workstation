import { OverviewWorkspace } from "@/components/admin/OverviewWorkspace";
import { auditLogService } from "@/lib/services/audit-logs";
import { okrService } from "@/lib/services/okr";
import { getOverviewQueue } from "@/lib/services/overview-queue";

export default async function AdminOverviewPage() {
  const [dashboardResult, auditLogResult, queueResult] = await Promise.all([
    okrService.getDashboard(),
    auditLogService.list(10),
    getOverviewQueue(),
  ]);
  return <OverviewWorkspace initialDashboard={dashboardResult} initialAuditLogs={auditLogResult} initialQueue={queueResult} />;
}
