import { CareerActivitiesWorkspace } from "@/components/admin/CareerActivitiesWorkspace";
import { careerActivityService } from "@/lib/services/career-activities";

export default async function AdminActivitiesPage({ searchParams }: { searchParams: Promise<{ activity?: string | string[] }> }) {
  const raw = (await searchParams).activity;
  const targetActivityId = typeof raw === "string" && raw.length <= 128 && raw.trim() ? raw : null;
  const activities = await careerActivityService.list();
  return <CareerActivitiesWorkspace key={targetActivityId ?? "list"} initialActivities={activities} targetActivityId={targetActivityId} />;
}
