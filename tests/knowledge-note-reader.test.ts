import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readIndexedMarkdownNote } from "../src/lib/knowledge/note-reader";

describe("indexed Markdown note reader", () => {
  let rootPath: string;

  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), "workstation-note-reader-"));
    await mkdir(join(rootPath, "notes"));
    await writeFile(join(rootPath, "notes", "entry.md"), "# Entry", "utf8");
  });

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true });
  });

  it("reads a Markdown file beneath the vault root", async () => {
    await expect(readIndexedMarkdownNote(rootPath, "notes/entry.md")).resolves.toEqual({ content: "# Entry" });
  });

  it("rejects a relative path that escapes the vault root", async () => {
    await expect(readIndexedMarkdownNote(rootPath, "../outside.md")).rejects.toThrow("Note unavailable");
  });

  it("rejects a symlink that resolves outside the vault root", async () => {
    const outsidePath = join(rootPath, "..", `${rootPath.split(/[\\/]/).at(-1)}-outside.md`);
    await writeFile(outsidePath, "# Outside", "utf8");
    try {
      await symlink(outsidePath, join(rootPath, "notes", "outside.md"), "file");
      await expect(readIndexedMarkdownNote(rootPath, "notes/outside.md")).rejects.toThrow("Note unavailable");
    } finally {
      await rm(outsidePath, { force: true });
    }
  });
});
