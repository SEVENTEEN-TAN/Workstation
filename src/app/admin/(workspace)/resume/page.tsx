import { ResumeFilesWorkspace } from "@/components/admin/ResumeFilesWorkspace";
import type { ResumeFileData } from "@/components/admin/types";
import { getResumeFileService } from "@/lib/services/resume-files";

export default async function AdminResumePage() {
  const files = await (await getResumeFileService()).list();
  return <ResumeFilesWorkspace initialFiles={JSON.parse(JSON.stringify(files)) as ResumeFileData[]} />;
}
