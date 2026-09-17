import { describe, expect, it } from "vitest";

import { buildKnowledgeNoteTree, readKnowledgeProperties } from "../src/components/admin/knowledge-note-tree";
import type { KnowledgeNoteData } from "../src/components/admin/types";

function note(relativePath: string, frontmatterJson: string | null = null): KnowledgeNoteData {
  const fileName = relativePath.split("/").at(-1)!;
  return {
    id: relativePath,
    vaultId: "vault-1",
    relativePath,
    fileName,
    directoryPath: relativePath.includes("/") ? relativePath.slice(0, relativePath.lastIndexOf("/")) : "",
    sizeBytes: 1,
    modifiedAt: "2026-09-17T00:00:00.000Z",
    contentHash: "hash",
    visibility: "PRIVATE",
    hasFrontmatter: Boolean(frontmatterJson),
    hasWikilinks: false,
    hasEmbeds: false,
    hasCallouts: false,
    hasDataview: false,
    hasTasks: false,
    isMoc: false,
    frontmatterJson,
    indexedAt: "2026-09-17T00:00:00.000Z",
  };
}

describe("knowledge note tree", () => {
  it("groups nested notes into stable directory branches", () => {
    const tree = buildKnowledgeNoteTree([
      note("projects/workstation/overview.md"),
      note("projects/readme.md"),
      note("Inbox.md"),
      note("career/2026.md"),
    ]);

    expect(tree.map((item) => [item.kind, item.name])).toEqual([
      ["directory", "career"],
      ["directory", "projects"],
      ["note", "Inbox.md"],
    ]);
    expect(tree[1]).toMatchObject({
      kind: "directory",
      children: [
        { kind: "directory", name: "workstation", children: [{ kind: "note", name: "overview.md" }] },
        { kind: "note", name: "readme.md" },
      ],
    });
  });

  it("exposes plain frontmatter properties while ignoring invalid snapshots", () => {
    expect(readKnowledgeProperties(note("note.md", JSON.stringify({
      title: "Workstation",
      tags: ["career", "project"],
      published: false,
      nested: { hidden: true },
    })))).toEqual([
      ["title", "Workstation"],
      ["tags", "career, project"],
      ["published", "false"],
    ]);
    expect(readKnowledgeProperties(note("broken.md", "not-json"))).toEqual([]);
  });
});
