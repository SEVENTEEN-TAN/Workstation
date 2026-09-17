import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readKnowledgeSyncConfig, resolveRequestedAttachment, syncKnowledge } from "../src/lib/knowledge/sync-client";

describe("Windows knowledge sync client", () => {
  it("reads required client configuration without accepting an insecure endpoint", () => {
    expect(readKnowledgeSyncConfig({
      KNOWLEDGE_SYNC_URL: "https://workstation.example",
      KNOWLEDGE_SYNC_TOKEN: "secret-token",
      KNOWLEDGE_SYNC_VAULT_ID: "vault-1",
      KNOWLEDGE_SYNC_VAULT_PATH: "F:\\Project\\Obsidian\\PersonalTech",
    })).toMatchObject({ vaultId: "vault-1", vaultPath: "F:\\Project\\Obsidian\\PersonalTech" });
    expect(() => readKnowledgeSyncConfig({
      KNOWLEDGE_SYNC_URL: "ftp://workstation.example",
      KNOWLEDGE_SYNC_TOKEN: "secret-token",
      KNOWLEDGE_SYNC_VAULT_ID: "vault-1",
      KNOWLEDGE_SYNC_VAULT_PATH: "F:\\Project\\Obsidian\\PersonalTech",
    })).toThrow("Knowledge sync configuration is invalid");
  });

  it("posts a scanner result with a bearer token and returns only the summary", async () => {
    const config = readKnowledgeSyncConfig({
      KNOWLEDGE_SYNC_URL: "https://workstation.example/base",
      KNOWLEDGE_SYNC_TOKEN: "secret-token",
      KNOWLEDGE_SYNC_VAULT_ID: "vault-1",
      KNOWLEDGE_SYNC_VAULT_PATH: "F:\\Project\\Obsidian\\PersonalTech",
    });
    const requests: Request[] = [];
    const summary = await syncKnowledge(config, async () => ({ scannedAt: new Date(), notes: [], links: [] }), async (request) => {
      requests.push(request);
      return request.method === "POST"
        ? Response.json({ summary: { addedCount: 1, modifiedCount: 0, movedCount: 0, missingCount: 0, unchangedCount: 0 } })
        : Response.json({ requests: [] });
    });

    expect(summary).toMatchObject({ addedCount: 1 });
    expect(requests[0].url).toBe("https://workstation.example/api/sync/knowledge/vaults/vault-1");
    expect(requests[0].headers.get("authorization")).toBe("Bearer secret-token");
    expect(requests[1].url).toBe("https://workstation.example/api/sync/knowledge/vaults/vault-1/attachments");
  });

  it("resolves only a unique image inside the configured Vault", async () => {
    const root = await mkdtemp(join(tmpdir(), "knowledge-sync-"));
    await mkdir(join(root, "notes", "assets"), { recursive: true });
    await writeFile(join(root, "notes", "assets", "diagram.png"), new Uint8Array([1]));

    await expect(resolveRequestedAttachment(root, "notes/entry.md", "diagram.png"))
      .resolves.toBe(join(root, "notes", "assets", "diagram.png"));
    await expect(resolveRequestedAttachment(root, "notes/entry.md", "../../outside.png")).resolves.toBeNull();
  });

  it("uploads a requested Vault image after the Markdown snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "knowledge-sync-upload-"));
    await mkdir(join(root, "notes", "assets"), { recursive: true });
    await writeFile(join(root, "notes", "assets", "diagram.png"), new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    const config = readKnowledgeSyncConfig({
      KNOWLEDGE_SYNC_URL: "https://workstation.example",
      KNOWLEDGE_SYNC_TOKEN: "secret-token",
      KNOWLEDGE_SYNC_VAULT_ID: "vault-1",
      KNOWLEDGE_SYNC_VAULT_PATH: root,
    });
    const requests: Request[] = [];

    await syncKnowledge(config, async () => ({ scannedAt: new Date(), notes: [], links: [] }), async (request) => {
      requests.push(request);
      if (request.url.endsWith("/attachments") && request.method === "GET") {
        return Response.json({ requests: [{ id: "request-1", target: "diagram.png", sourceRevision: { relativePath: "notes/entry.md" } }] });
      }
      if (request.url.includes("/attachments/request-1")) return Response.json({ status: "UPLOADED" });
      return Response.json({ summary: { addedCount: 0, modifiedCount: 0, movedCount: 0, missingCount: 0, unchangedCount: 0 } });
    });

    expect(requests.map((request) => `${request.method} ${new URL(request.url).pathname}`)).toEqual([
      "POST /api/sync/knowledge/vaults/vault-1",
      "GET /api/sync/knowledge/vaults/vault-1/attachments",
      "POST /api/sync/knowledge/attachments/request-1",
    ]);
  });
});
