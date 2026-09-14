import { OverviewWorkspace } from "@/components/admin/OverviewWorkspace";
import type { DashboardData } from "@/components/admin/types";
import { okrService } from "@/lib/services/okr";

export default async function AdminOverviewPage() {
  const dashboard = JSON.parse(JSON.stringify(await okrService.getDashboard())) as DashboardData;
  return <OverviewWorkspace initialDashboard={dashboard} />;
}
