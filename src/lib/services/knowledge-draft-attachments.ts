import { getDatabase } from "../db";
import { isArticleImageEmbedTarget } from "../knowledge/article-attachments";

type DraftRecord = { markdown: string };
type ImageAsset = { id: string };
type AttachmentInput = { draftId: string; target: string; assetId: string };

type KnowledgeDraftAttachmentRepository = {
  findDraft(id: string): Promise<DraftRecord | null>;
  findImageAsset(id: string): Promise<ImageAsset | null>;
  upsertAttachment(input: AttachmentInput): Promise<unknown>;
};

function embedTargets(markdown: string) {
  return [...markdown.matchAll(/!\[\[([^\]\r\n]+)\]\]/g)].map((match) => match[1].trim());
}

function defaultRepository(): KnowledgeDraftAttachmentRepository {
  return {
    async findDraft(id) {
      return (await getDatabase()).knowledgePublicationDraft.findUnique({ where: { id }, select: { markdown: true } });
    },
    async findImageAsset(id) {
      return (await getDatabase()).asset.findFirst({
        where: { id, mimeType: { in: ["image/png", "image/jpeg", "image/webp"] } },
        select: { id: true },
      });
    },
    async upsertAttachment(input) {
      return (await getDatabase()).knowledgePublicationDraftAttachment.upsert({
        where: { draftId_target: { draftId: input.draftId, target: input.target } },
        update: { assetId: input.assetId },
        create: input,
      });
    },
  };
}

export function createKnowledgeDraftAttachmentService(repository: KnowledgeDraftAttachmentRepository = defaultRepository()) {
  return {
    async select(draftId: string, target: string, assetId: string) {
      const [draft, asset] = await Promise.all([repository.findDraft(draftId), repository.findImageAsset(assetId)]);
      if (!draft || !asset || !isArticleImageEmbedTarget(target) || !embedTargets(draft.markdown).includes(target)) throw new Error("Attachment unavailable");
      return repository.upsertAttachment({ draftId, target, assetId });
    },
  };
}

export const knowledgeDraftAttachmentService = createKnowledgeDraftAttachmentService();
