import { OkrMilestoneDraftWorkspace } from "@/components/admin/OkrMilestoneDraftWorkspace";
import type { OkrMilestoneDraftData } from "@/components/admin/types";
import { okrMilestoneDraftService } from "@/lib/services/okr-milestone-drafts";

export default async function AdminMilestonesPage() {
  const drafts = JSON.parse(JSON.stringify(await okrMilestoneDraftService.list())) as OkrMilestoneDraftData[];
  return <OkrMilestoneDraftWorkspace initialDrafts={drafts} />;
}
