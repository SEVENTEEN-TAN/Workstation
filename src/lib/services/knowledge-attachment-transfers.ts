import { rm } from "node:fs/promises";

import { getDatabase } from "../db";
import { saveImageAsset } from "./assets";

type TransferRequest = { id: string; draftId: string; target: string; status: string; assetId: string | null };
type StoredAsset = { id: string; storagePath: string };

type Repository = {
  listPending(vaultId: string): Promise<unknown[]>;
  findRequest(id: string): Promise<TransferRequest | null>;
  complete(request: TransferRequest, assetId: string): Promise<unknown>;
  removeAsset(asset: StoredAsset): Promise<void>;
};

function defaultRepository(): Repository {
  return {
    async listPending(vaultId) {
      return (await getDatabase()).knowledgeAttachmentTransferRequest.findMany({
        where: { vaultId, status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: { id: true, target: true, sourceRevision: { select: { relativePath: true } } },
      });
    },
    async findRequest(id) {
      return (await getDatabase()).knowledgeAttachmentTransferRequest.findUnique({
        where: { id },
        select: { id: true, draftId: true, target: true, status: true, assetId: true },
      });
    },
    async complete(request, assetId) {
      const database = await getDatabase();
      return database.$transaction(async (transaction) => {
        await transaction.knowledgePublicationDraftAttachment.upsert({
          where: { draftId_target: { draftId: request.draftId, target: request.target } },
          update: { assetId },
          create: { draftId: request.draftId, target: request.target, assetId },
        });
        return transaction.knowledgeAttachmentTransferRequest.update({
          where: { id: request.id },
          data: { status: "UPLOADED", assetId },
          select: { id: true, status: true, assetId: true },
        });
      });
    },
    async removeAsset(asset) {
      await (await getDatabase()).asset.delete({ where: { id: asset.id } });
      await rm(asset.storagePath, { force: true });
    },
  };
}

export function createKnowledgeAttachmentTransferService(
  repository: Repository = defaultRepository(),
  store: (file: File) => Promise<StoredAsset> = (file) => saveImageAsset(file),
) {
  return {
    listPending: (vaultId: string) => repository.listPending(vaultId),
    async upload(id: string, file: File) {
      const request = await repository.findRequest(id);
      if (request?.status === "UPLOADED" && request.assetId) return { id: request.id, status: request.status, assetId: request.assetId };
      if (!request || request.status !== "PENDING") throw new Error("Attachment transfer unavailable");
      const asset = await store(file);
      try {
        return await repository.complete(request, asset.id);
      } catch (error) {
        await repository.removeAsset(asset).catch(() => undefined);
        throw error;
      }
    },
  };
}

export const knowledgeAttachmentTransferService = createKnowledgeAttachmentTransferService();
