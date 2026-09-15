import { notFound } from "next/navigation";

import { OkrCycleWorkspace } from "@/components/admin/okr/OkrCycleWorkspace";
import type { OkrCycleData } from "@/components/admin/types";
import { okrService } from "@/lib/services/okr";

type Props = { params: Promise<{ cycleId: string }> };

export default async function AdminOkrCyclePage({ params }: Props) {
  const cycle = await okrService.getCycle((await params).cycleId);
  if (!cycle) notFound();

  return <OkrCycleWorkspace initialCycle={JSON.parse(JSON.stringify(cycle)) as OkrCycleData} />;
}
