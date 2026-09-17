import { describe, expect, it } from "vitest";

import { readKnowledgeSyncConfig, syncKnowledge } from "../src/lib/knowledge/sync-client";

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
      return Response.json({ summary: { addedCount: 1, modifiedCount: 0, movedCount: 0, missingCount: 0, unchangedCount: 0 } });
    });

    expect(summary).toMatchObject({ addedCount: 1 });
    expect(requests[0].url).toBe("https://workstation.example/api/sync/knowledge/vaults/vault-1");
    expect(requests[0].headers.get("authorization")).toBe("Bearer secret-token");
  });
});
