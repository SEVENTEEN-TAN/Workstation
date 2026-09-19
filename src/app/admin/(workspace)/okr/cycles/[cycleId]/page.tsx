import { notFound } from "next/navigation";

import { OkrCycleWorkspace } from "@/components/admin/okr/OkrCycleWorkspace";
import type { OkrCycleData } from "@/components/admin/types";
import { aiContentDraftService } from "@/lib/services/ai-content-drafts";
import { okrService } from "@/lib/services/okr";

type Props = { params: Promise<{ cycleId: string }> };

export default async function AdminOkrCyclePage({ params }: Props) {
  const cycleId = (await params).cycleId;
  const [cycle, drafts] = await Promise.all([
    okrService.getCycle(cycleId),
    aiContentDraftService.list("OKR_REVIEW", cycleId),
  ]);
  if (!cycle) notFound();

  return <OkrCycleWorkspace
    initialCycle={JSON.parse(JSON.stringify(cycle)) as OkrCycleData}
    initialAiDrafts={drafts.flatMap((draft) => draft.useCase === "OKR_REVIEW" ? [draft] : [])}
  />;
}
