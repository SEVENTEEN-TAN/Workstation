import { readFile } from "node:fs/promises";

import { getDatabase } from "../db";

type ArticleAttachmentRecord = {
  storagePath: string;
  mimeType: string;
  sha256: string;
};

type KnowledgeArticleAttachmentRepository = {
  findAttachment(id: string): Promise<ArticleAttachmentRecord | null>;
};

function defaultRepository(): KnowledgeArticleAttachmentRepository {
  return {
    async findAttachment(id) {
      return (await getDatabase()).knowledgeArticleAttachment.findUnique({
        where: { id },
        select: { storagePath: true, mimeType: true, sha256: true },
      });
    },
  };
}

export function createKnowledgeArticleAttachmentReader(
  repository: KnowledgeArticleAttachmentRepository = defaultRepository(),
  readSnapshot: (path: string) => Promise<Uint8Array> = readFile,
) {
  return {
    async get(id: string, ifNoneMatch: string | null) {
      const attachment = await repository.findAttachment(id);
      if (!attachment) return new Response("Not found", { status: 404 });
      const etag = `"${attachment.sha256}"`;
      const headers = {
        "content-type": attachment.mimeType,
        "cache-control": "public, max-age=31536000, immutable",
        etag,
      };
      if (ifNoneMatch === etag) return new Response(null, { status: 304, headers });
      try {
        return new Response(new Uint8Array(await readSnapshot(attachment.storagePath)).buffer, { headers });
      } catch {
        return new Response("Not found", { status: 404 });
      }
    },
  };
}

export const knowledgeArticleAttachmentReader = createKnowledgeArticleAttachmentReader();
