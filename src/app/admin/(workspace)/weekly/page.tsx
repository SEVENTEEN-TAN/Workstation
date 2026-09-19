import { WeeklyActivityWorkspace } from "@/components/admin/WeeklyActivityWorkspace";
import { weeklyActivityDraftService } from "@/lib/services/weekly-activity-drafts";

export default async function AdminWeeklyPage() {
  return <WeeklyActivityWorkspace initialDrafts={await weeklyActivityDraftService.list()} />;
}
