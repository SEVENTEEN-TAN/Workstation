import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

export type DraftAttachmentSource = {
  target: string;
  assetId: string;
  asset: {
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
  };
};

export type ArticleAttachmentSnapshot = {
  id: string;
  target: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

export function createArticleAttachmentSnapshotter(root = resolve(process.cwd(), "data", "article-attachments")) {
  const snapshotRoot = resolve(root);

  return {
    async snapshot(articleId: string, attachments: DraftAttachmentSource[]) {
      const articleRoot = resolve(snapshotRoot, articleId);
      if (!articleRoot.startsWith(`${snapshotRoot}${sep}`)) throw new Error("Invalid article attachment path");
      await mkdir(articleRoot, { recursive: true });

      const snapshots: ArticleAttachmentSnapshot[] = [];
      try {
        for (const attachment of attachments) {
          const bytes = await readFile(attachment.asset.storagePath);
          const sha256 = createHash("sha256").update(bytes).digest("hex");
          if (sha256 !== attachment.asset.sha256 || bytes.byteLength !== attachment.asset.sizeBytes) {
            throw new Error("Source attachment changed");
          }
          const id = randomUUID();
          const storagePath = resolve(articleRoot, id);
          await writeFile(storagePath, bytes, { flag: "wx" });
          snapshots.push({ id, target: attachment.target, storagePath, mimeType: attachment.asset.mimeType, sizeBytes: bytes.byteLength, sha256 });
        }
        return snapshots;
      } catch (error) {
        await Promise.all(snapshots.map((snapshot) => rm(snapshot.storagePath, { force: true })));
        throw error;
      }
    },
    async remove(snapshots: ArticleAttachmentSnapshot[]) {
      await Promise.all(snapshots.map((snapshot) => rm(snapshot.storagePath, { force: true })));
    },
  };
}
