import { ExperienceRecordsWorkspace } from "@/components/admin/ExperienceRecordsWorkspace";
import type { ExperienceRecordData } from "@/components/admin/types";
import { experienceRecordService } from "@/lib/services/experience-records";

export default async function AdminExperiencePage() {
  const records = await experienceRecordService.list();
  return <ExperienceRecordsWorkspace initialRecords={JSON.parse(JSON.stringify(records)) as ExperienceRecordData[]} />;
}
