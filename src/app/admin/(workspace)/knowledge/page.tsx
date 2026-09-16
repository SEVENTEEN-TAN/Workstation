import { KnowledgeWorkspace } from "@/components/admin/KnowledgeWorkspace";
import type { KnowledgeVaultData } from "@/components/admin/types";
import { knowledgeVaultService } from "@/lib/services/knowledge-vaults";

export default async function AdminKnowledgePage() {
  const vaults = JSON.parse(JSON.stringify(await knowledgeVaultService.list())) as KnowledgeVaultData[];
  return <KnowledgeWorkspace initialVaults={vaults} />;
}
