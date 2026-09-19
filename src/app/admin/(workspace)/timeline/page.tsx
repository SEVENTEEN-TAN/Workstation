import { CareerTimelineDraftWorkspace } from "@/components/admin/CareerTimelineDraftWorkspace";
import { careerTimelineDraftService } from "@/lib/services/career-timeline-drafts";

export default async function AdminTimelinePage() {
  return <CareerTimelineDraftWorkspace initialDrafts={await careerTimelineDraftService.list()} />;
}
