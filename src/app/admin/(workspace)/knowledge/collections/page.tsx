import { KnowledgeCollectionsWorkspace } from "@/components/admin/KnowledgeCollectionsWorkspace";
import { knowledgeCollectionService } from "@/lib/services/knowledge-collections";

export default async function AdminKnowledgeCollectionsPage() {
  const [collections, articles] = await Promise.all([
    knowledgeCollectionService.listAdmin(),
    knowledgeCollectionService.listPublishedArticles(),
  ]);
  return <KnowledgeCollectionsWorkspace
    initialCollections={collections}
    initialArticles={articles}
  />;
}
