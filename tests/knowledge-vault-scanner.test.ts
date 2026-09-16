import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { scanVault } from "../src/lib/knowledge/vault-scanner";
import { knowledgeVaultInputSchema } from "../src/lib/validators/knowledge-vaults";

describe("knowledge vault scanner", () => {
  let rootPath: string;

  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), "workstation-vault-"));
  });

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true });
  });

  it("indexes Markdown metadata and Obsidian syntax flags without ignored files", async () => {
    const richContent = [
      "---",
      "title: Rich note",
      "tags: [obsidian]",
      "---",
      "",
      "![[attachment.png]]",
      "[[Plain note|plain]]",
      "",
      "> [!note] Obsidian callout",
      "",
      "```dataview",
      "list from #obsidian",
      "```",
      "",
      "- [ ] Capture an Obsidian task",
      "",
    ].join("\n");
    const plainContent = "# Plain note\n";
    await Promise.all([
      mkdir(join(rootPath, "notes")),
      mkdir(join(rootPath, ".obsidian")),
      mkdir(join(rootPath, ".trash")),
      mkdir(join(rootPath, ".claudian")),
      mkdir(join(rootPath, ".workbuddy")),
      mkdir(join(rootPath, "private")),
      mkdir(join(rootPath, "archive", "drafts"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(rootPath, "notes", "rich.md"), richContent, "utf8"),
      writeFile(join(rootPath, "notes", "plain.md"), plainContent, "utf8"),
      writeFile(join(rootPath, "notes", "diagram.excalidraw.md"), "ignored", "utf8"),
      writeFile(join(rootPath, ".obsidian", "workspace.md"), "ignored", "utf8"),
      writeFile(join(rootPath, ".trash", "deleted.md"), "ignored", "utf8"),
      writeFile(join(rootPath, ".claudian", "session.md"), "ignored", "utf8"),
      writeFile(join(rootPath, ".workbuddy", "cache.md"), "ignored", "utf8"),
      writeFile(join(rootPath, "private", "secret.md"), "ignored", "utf8"),
      writeFile(join(rootPath, "archive", "drafts", "draft.md"), "ignored", "utf8"),
      writeFile(join(rootPath, "attachment.png"), "ignored", "utf8"),
    ]);

    const result = await scanVault(rootPath, ["private", "archive/drafts", "*.excalidraw.md"]);

    expect(result.notes.map((note) => note.relativePath)).toEqual(["notes/plain.md", "notes/rich.md"]);
    expect(result.notes[1]).toMatchObject({
      fileName: "rich.md",
      directoryPath: "notes",
      sizeBytes: Buffer.byteLength(richContent, "utf8"),
      sha256: createHash("sha256").update(richContent).digest("hex"),
      hasFrontmatter: true,
      hasWikilinks: true,
      hasEmbeds: true,
      hasCallouts: true,
      hasDataview: true,
      hasTasks: true,
    });
    expect(result.notes[0].modifiedAt).toBeInstanceOf(Date);
    expect(result.notes[0]).toMatchObject({
      fileName: "plain.md",
      directoryPath: "notes",
      hasFrontmatter: false,
      hasWikilinks: false,
      hasEmbeds: false,
      hasCallouts: false,
      hasDataview: false,
      hasTasks: false,
    });
  });

  it("rejects a missing vault root", async () => {
    await expect(scanVault(join(rootPath, "missing"))).rejects.toThrow("Vault root path does not exist or is not a directory");
  });

  it("keeps relative paths intact when the registered root ends with a separator", async () => {
    await mkdir(join(rootPath, "notes"));
    await writeFile(join(rootPath, "notes", "entry.md"), "# Entry", "utf8");

    await expect(scanVault(`${rootPath}${sep}`)).resolves.toMatchObject({
      notes: [expect.objectContaining({ relativePath: "notes/entry.md" })],
    });
  });

  it("does not follow file symlinks outside the vault", async () => {
    const outsidePath = join(rootPath, "..", `${rootPath.split(/[\\/]/).at(-1)}-outside.md`);
    await writeFile(outsidePath, "# Outside", "utf8");
    try {
      await symlink(outsidePath, join(rootPath, "outside.md"), "file");
      await expect(scanVault(rootPath)).resolves.toMatchObject({ notes: [] });
    } finally {
      await rm(outsidePath, { force: true });
    }
  });
});

describe("knowledge vault validation", () => {
  it("normalizes registration input and ignore patterns", () => {
    expect(knowledgeVaultInputSchema.parse({
      name: "  Personal Tech  ",
      rootPath: " F:\\Project\\Obsidian\\个人技术栈 ",
      ignorePatterns: [" private ", "", "private"],
      enabled: true,
    })).toEqual({
      name: "Personal Tech",
      rootPath: "F:\\Project\\Obsidian\\个人技术栈",
      ignorePatterns: ["private"],
      enabled: true,
    });
  });
});
