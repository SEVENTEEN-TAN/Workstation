import { KnowledgeWorkspace } from "@/components/admin/KnowledgeWorkspace";
import { knowledgeVaultService } from "@/lib/services/knowledge-vaults";
import { knowledgeGraphService } from "@/lib/services/knowledge-graph";
import { KnowledgeGraphWorkspace } from "@/components/admin/KnowledgeGraphWorkspace";
import styles from "@/components/admin/knowledge-graph-admin.module.css";

export default async function AdminKnowledgePage({ searchParams }: { searchParams: Promise<{ vault?: string | string[]; revision?: string | string[] }> }) {
  const { vault, revision } = await searchParams;
  const initialVaultId = typeof vault === "string" ? vault : undefined;
  const initialRevisionId = typeof revision === "string" ? revision : undefined;
  const [graphData, vaults] = await Promise.all([knowledgeGraphService.getAdmin(), knowledgeVaultService.list()]);
  return <><KnowledgeGraphWorkspace initialData={graphData} /><details className={styles.legacy} open={Boolean(initialVaultId || initialRevisionId)}><summary>已有 Vault 索引与文章管理（高级）</summary><div><KnowledgeWorkspace key={`${initialVaultId ?? ""}:${initialRevisionId ?? ""}`} initialVaults={vaults} initialVaultId={initialVaultId} initialRevisionId={initialRevisionId} /></div></details></>;
}
