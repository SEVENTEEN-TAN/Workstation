import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createArticleAttachmentSnapshotter } from "../src/lib/knowledge/article-attachment-snapshots";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("article attachment snapshotter", () => {
  it("copies source bytes into article-owned immutable storage", async () => {
    const directory = await mkdtemp(join(tmpdir(), "workstation-attachment-"));
    directories.push(directory);
    const sourcePath = join(directory, "source.png");
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await writeFile(sourcePath, bytes);
    const snapshotter = createArticleAttachmentSnapshotter(join(directory, "snapshots"));

    const [snapshot] = await snapshotter.snapshot("article-1", [{
      target: "diagram.png",
      assetId: "asset-1",
      asset: { storagePath: sourcePath, mimeType: "image/png", sizeBytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") },
    }]);

    expect(snapshot).toMatchObject({ target: "diagram.png", mimeType: "image/png", sizeBytes: 4 });
    await expect(readFile(snapshot.storagePath)).resolves.toEqual(Buffer.from(bytes));
    expect(snapshot.storagePath).toContain(join(directory, "snapshots", "article-1"));
  });
});
