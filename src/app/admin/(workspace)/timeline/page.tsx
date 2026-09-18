import { CareerTimelineDraftWorkspace } from "@/components/admin/CareerTimelineDraftWorkspace";
import type { CareerTimelineDraftData } from "@/components/admin/types";
import { careerTimelineDraftService } from "@/lib/services/career-timeline-drafts";

export default async function AdminTimelinePage() {
  const drafts = JSON.parse(JSON.stringify(await careerTimelineDraftService.list())) as CareerTimelineDraftData[];
  return <CareerTimelineDraftWorkspace initialDrafts={drafts} />;
}
