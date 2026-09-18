import { WeeklyActivityWorkspace } from "@/components/admin/WeeklyActivityWorkspace";
import type { WeeklyActivityDraftData } from "@/components/admin/types";
import { weeklyActivityDraftService } from "@/lib/services/weekly-activity-drafts";

export default async function AdminWeeklyPage() {
  const drafts = JSON.parse(JSON.stringify(await weeklyActivityDraftService.list())) as WeeklyActivityDraftData[];
  return <WeeklyActivityWorkspace initialDrafts={drafts} />;
}
