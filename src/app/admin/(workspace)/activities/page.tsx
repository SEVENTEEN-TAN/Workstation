import { CareerActivitiesWorkspace } from "@/components/admin/CareerActivitiesWorkspace";
import { careerActivityService } from "@/lib/services/career-activities";

export default async function AdminActivitiesPage() {
  const activities = await careerActivityService.list();
  return <CareerActivitiesWorkspace initialActivities={activities} />;
}
