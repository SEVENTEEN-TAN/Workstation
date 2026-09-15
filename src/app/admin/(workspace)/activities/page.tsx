import { CareerActivitiesWorkspace } from "@/components/admin/CareerActivitiesWorkspace";
import type { CareerActivityData } from "@/components/admin/types";
import { careerActivityService } from "@/lib/services/career-activities";

export default async function AdminActivitiesPage() {
  const activities = JSON.parse(JSON.stringify(await careerActivityService.list())) as CareerActivityData[];
  return <CareerActivitiesWorkspace initialActivities={activities} />;
}
