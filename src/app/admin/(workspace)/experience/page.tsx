import { ExperienceRecordsWorkspace } from "@/components/admin/ExperienceRecordsWorkspace";
import { experienceRecordService } from "@/lib/services/experience-records";

export default async function AdminExperiencePage() {
  const records = await experienceRecordService.list();
  return <ExperienceRecordsWorkspace initialRecords={records} />;
}
