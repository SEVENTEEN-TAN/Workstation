import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createArticleAttachmentSnapshotter } from "../src/lib/knowledge/article-attachment-snapshots";

function readProjectFile(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("article attachment persistence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses the configured persistent attachment directory for snapshots", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "workstation-attachments-"));
    const attachmentRoot = join(temporaryRoot, "persistent", "article-attachments");
    const sourcePath = join(temporaryRoot, "source.webp");
    const sourceBytes = Buffer.from("attachment");

    try {
      vi.spyOn(process, "cwd").mockReturnValue(join(temporaryRoot, "app"));
      vi.stubEnv("ARTICLE_ATTACHMENT_DIR", attachmentRoot);
      await writeFile(sourcePath, sourceBytes);

      const snapshots = await createArticleAttachmentSnapshotter().snapshot("article-1", [{
        target: "diagram.webp",
        assetId: "asset-1",
        asset: {
          storagePath: sourcePath,
          mimeType: "image/webp",
          sizeBytes: sourceBytes.byteLength,
          sha256: createHash("sha256").update(sourceBytes).digest("hex"),
        },
      }]);

      expect(snapshots[0]?.storagePath.startsWith(attachmentRoot)).toBe(true);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("includes attachment snapshots in backup and restore contracts", () => {
    expect(readProjectFile("scripts/backup.ts")).toContain("resolveArticleAttachmentRoot");
    expect(readProjectFile("scripts/backup.ts")).toContain('"article-attachments"');
    expect(readProjectFile("src/lib/backup/paths.ts")).toContain('"article-attachments"');
    expect(readProjectFile("scripts/restore.ts")).toContain("resolveArticleAttachmentRoot");
    expect(readProjectFile("scripts/restore.ts")).toContain("source.attachmentsPath");
  });
});
