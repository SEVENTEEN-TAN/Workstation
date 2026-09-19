import { KnowledgeWorkspace } from "@/components/admin/KnowledgeWorkspace";
import { knowledgeVaultService } from "@/lib/services/knowledge-vaults";

export default async function AdminKnowledgePage() {
  return <KnowledgeWorkspace initialVaults={await knowledgeVaultService.list()} />;
}
