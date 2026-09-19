import { OkrMilestoneDraftWorkspace } from "@/components/admin/OkrMilestoneDraftWorkspace";
import { okrMilestoneDraftService } from "@/lib/services/okr-milestone-drafts";

export default async function AdminMilestonesPage() {
  return <OkrMilestoneDraftWorkspace initialDrafts={await okrMilestoneDraftService.list()} />;
}
