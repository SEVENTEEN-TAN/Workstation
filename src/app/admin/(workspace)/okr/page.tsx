import { OkrWorkspace } from "@/components/admin/OkrWorkspace";
import { okrService } from "@/lib/services/okr";

export default async function AdminOkrPage() {
  return <OkrWorkspace initialCycles={await okrService.listCycles()} />;
}
