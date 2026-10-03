import { randomUUID } from "node:crypto";
import { getDatabase } from "../db";
import { knowledgeGraphPublishSchema, knowledgeGraphSchema, selectKnowledgeGraphCategories, type KnowledgeGraph } from "../knowledge/graph-contract";

export type KnowledgeGraphState = {
  revisionId: string;
  draft: KnowledgeGraph;
  importedAt: Date;
  published: KnowledgeGraph | null;
  publishedAt: Date | null;
};
export type KnowledgeGraphRepository = {
  read(): Promise<KnowledgeGraphState | null>;
  saveDraft(revisionId: string, graph: KnowledgeGraph, importedAt: Date): Promise<void>;
  publish(revisionId: string, graph: KnowledgeGraph, publishedAt: Date): Promise<boolean>;
};

function defaultRepository(): KnowledgeGraphRepository {
  return {
    async read() {
      const record = await (await getDatabase()).knowledgeGraphState.findUnique({ where: { id: "public" } });
      return record ? { revisionId: record.revisionId, draft: knowledgeGraphSchema.parse(record.draft), importedAt: record.importedAt, published: record.published === null ? null : knowledgeGraphSchema.parse(record.published), publishedAt: record.publishedAt } : null;
    },
    async saveDraft(revisionId, graph, importedAt) {
      await (await getDatabase()).knowledgeGraphState.upsert({ where: { id: "public" }, create: { id: "public", revisionId, draft: graph, importedAt }, update: { revisionId, draft: graph, importedAt } });
    },
    async publish(revisionId, graph, publishedAt) {
      const result = await (await getDatabase()).knowledgeGraphState.updateMany({ where: { id: "public", revisionId }, data: { published: graph, publishedAt } });
      return result.count === 1;
    },
  };
}

function adminView(state: KnowledgeGraphState | null) {
  return {
    draft: state ? { revisionId: state.revisionId, graph: state.draft, importedAt: state.importedAt.toISOString() } : null,
    published: state?.published && state.publishedAt ? { publishedAt: state.publishedAt.toISOString(), nodeCount: state.published.nodes.length, edgeCount: state.published.edges.length, categories: [...new Set(state.published.nodes.map((node) => node.category))].sort() } : null,
  };
}
export type KnowledgeGraphAdminData = ReturnType<typeof adminView>;

export function createKnowledgeGraphService(repository: KnowledgeGraphRepository = defaultRepository()) {
  return {
    async getAdmin(): Promise<KnowledgeGraphAdminData> { return adminView(await repository.read()); },
    async importGraph(input: unknown): Promise<KnowledgeGraphAdminData> {
      const graph = knowledgeGraphSchema.parse(input);
      await repository.saveDraft(randomUUID(), graph, new Date());
      return adminView(await repository.read());
    },
    async publish(input: unknown): Promise<KnowledgeGraphAdminData> {
      const { revisionId, categories } = knowledgeGraphPublishSchema.parse(input);
      const state = await repository.read();
      if (!state || state.revisionId !== revisionId) throw new Error("图谱草稿已更新，请刷新预览后再发布");
      const graph = selectKnowledgeGraphCategories(state.draft, categories);
      if (!await repository.publish(revisionId, graph, new Date())) throw new Error("图谱草稿已更新，请刷新预览后再发布");
      return adminView(await repository.read());
    },
    async getPublished(): Promise<KnowledgeGraph | null> { return (await repository.read())?.published ?? null; },
  };
}
export const knowledgeGraphService = createKnowledgeGraphService();
export const getPublishedKnowledgeGraph = () => knowledgeGraphService.getPublished();
