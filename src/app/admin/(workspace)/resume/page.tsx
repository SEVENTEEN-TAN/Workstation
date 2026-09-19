import { ResumeFilesWorkspace } from "@/components/admin/ResumeFilesWorkspace";
import { getResumeFileService } from "@/lib/services/resume-files";

export default async function AdminResumePage() {
  const files = await (await getResumeFileService()).list();
  return <ResumeFilesWorkspace initialFiles={files} />;
}
