import { KnowledgeWorkspace } from "@/components/admin/KnowledgeWorkspace";
import { knowledgeVaultService } from "@/lib/services/knowledge-vaults";

export default async function AdminKnowledgePage({ searchParams }: { searchParams: Promise<{ vault?: string | string[]; revision?: string | string[] }> }) {
  const { vault, revision } = await searchParams;
  const initialVaultId = typeof vault === "string" ? vault : undefined;
  const initialRevisionId = typeof revision === "string" ? revision : undefined;
  return <KnowledgeWorkspace key={`${initialVaultId ?? ""}:${initialRevisionId ?? ""}`} initialVaults={await knowledgeVaultService.list()} initialVaultId={initialVaultId} initialRevisionId={initialRevisionId} />;
}
