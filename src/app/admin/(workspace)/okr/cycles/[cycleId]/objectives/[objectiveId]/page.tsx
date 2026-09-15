import { notFound } from "next/navigation";

import { ObjectiveWorkspace } from "@/components/admin/okr/ObjectiveWorkspace";
import type { ObjectiveDetailData } from "@/components/admin/types";
import { okrService } from "@/lib/services/okr";

type Props = { params: Promise<{ cycleId: string; objectiveId: string }> };

export default async function AdminOkrObjectivePage({ params }: Props) {
  const { cycleId, objectiveId } = await params;
  const objective = await okrService.getObjective(objectiveId, cycleId);
  if (!objective) notFound();

  return <ObjectiveWorkspace initialObjective={JSON.parse(JSON.stringify(objective)) as ObjectiveDetailData} />;
}
