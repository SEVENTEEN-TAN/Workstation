import { KnowledgeCollectionsWorkspace } from "@/components/admin/KnowledgeCollectionsWorkspace";
import type { KnowledgeCollectionArticleData, KnowledgeCollectionData } from "@/components/admin/types";
import { knowledgeCollectionService } from "@/lib/services/knowledge-collections";

export default async function AdminKnowledgeCollectionsPage() {
  const [collections, articles] = await Promise.all([
    knowledgeCollectionService.listAdmin(),
    knowledgeCollectionService.listPublishedArticles(),
  ]);
  return <KnowledgeCollectionsWorkspace
    initialCollections={JSON.parse(JSON.stringify(collections)) as KnowledgeCollectionData[]}
    initialArticles={JSON.parse(JSON.stringify(articles)) as KnowledgeCollectionArticleData[]}
  />;
}
