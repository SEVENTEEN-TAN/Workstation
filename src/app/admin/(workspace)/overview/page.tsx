import { OverviewWorkspace } from "@/components/admin/OverviewWorkspace";
import type { AuditLogData, DashboardData } from "@/components/admin/types";
import { auditLogService } from "@/lib/services/audit-logs";
import { okrService } from "@/lib/services/okr";

export default async function AdminOverviewPage() {
  const [dashboardResult, auditLogResult] = await Promise.all([
    okrService.getDashboard(),
    auditLogService.list(10),
  ]);
  const snapshot = JSON.parse(JSON.stringify({
    dashboard: dashboardResult,
    auditLogs: auditLogResult,
  })) as { dashboard: DashboardData; auditLogs: AuditLogData[] };

  return <OverviewWorkspace initialDashboard={snapshot.dashboard} initialAuditLogs={snapshot.auditLogs} />;
}
