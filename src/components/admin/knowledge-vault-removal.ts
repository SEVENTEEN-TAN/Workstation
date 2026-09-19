import type { KnowledgeVaultData } from "./types";

export function describeVaultRemoval(vault: Pick<KnowledgeVaultData, "sourceRevisions">) {
  const revisionCount = vault.sourceRevisions.length;
  const draftCount = vault.sourceRevisions.filter((revision) => revision.draft).length;
  const articleCount = vault.sourceRevisions.filter((revision) => revision.draft?.article).length;

  if (!draftCount && !articleCount) {
    return `将移除 ${revisionCount} 个源修订与工作站索引；本地 Vault 文件不会被删除或修改。`;
  }

  return `当前保留 ${revisionCount} 个源修订、${draftCount} 个发布草稿、${articleCount} 篇已发布文章。发布草稿或已发布文章依赖源修订，系统会阻止移除；请先处理发布草稿或下架文章。本地 Vault 文件不会被删除或修改。`;
}
