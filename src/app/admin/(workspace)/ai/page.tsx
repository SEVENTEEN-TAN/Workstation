import { AiProviderWorkspace } from "@/components/admin/AiProviderWorkspace";
import type { AiProviderStateData } from "@/components/admin/types";
import { aiProviderService } from "@/lib/services/ai-providers";

export default async function AdminAiPage() {
  const state = JSON.parse(JSON.stringify(await aiProviderService.listState())) as AiProviderStateData;
  return <AiProviderWorkspace initialState={state} />;
}
