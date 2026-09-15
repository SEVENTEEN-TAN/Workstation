import { OkrWorkspace } from "@/components/admin/OkrWorkspace";
import type { OkrCycleData } from "@/components/admin/types";
import { okrService } from "@/lib/services/okr";

export default async function AdminOkrPage() {
  const cycles = JSON.parse(JSON.stringify(await okrService.listCycles())) as OkrCycleData[];
  return <OkrWorkspace initialCycles={cycles} />;
}
