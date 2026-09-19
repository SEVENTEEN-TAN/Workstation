import { AiProviderWorkspace } from "@/components/admin/AiProviderWorkspace";
import { aiProviderService } from "@/lib/services/ai-providers";

export default async function AdminAiPage() {
  return <AiProviderWorkspace initialState={await aiProviderService.listState()} />;
}
