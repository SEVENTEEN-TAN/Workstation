import { z } from "zod";

import type { VaultScanResult } from "./vault-scanner";

export type KnowledgeSyncConfig = {
  serverUrl: URL;
  token: string;
  vaultId: string;
  vaultPath: string;
  ignorePatterns: string[];
};

type Environment = Record<string, string | undefined>;
type Scanner = (rootPath: string, ignorePatterns: readonly string[]) => Promise<VaultScanResult>;
type Fetcher = (request: Request) => Promise<Response>;

const summarySchema = z.object({
  addedCount: z.number().int().min(0),
  modifiedCount: z.number().int().min(0),
  movedCount: z.number().int().min(0),
  missingCount: z.number().int().min(0),
  unchangedCount: z.number().int().min(0),
}).strict();

function parseServerUrl(value: string | undefined) {
  try {
    const url = new URL(value ?? "");
    const isLocalHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol === "https:" || isLocalHttp) return url;
  } catch {
    // The generic configuration error below avoids echoing secrets or raw input.
  }
  throw new Error("Knowledge sync configuration is invalid");
}

function required(value: string | undefined) {
  if (!value?.trim()) throw new Error("Knowledge sync configuration is invalid");
  return value.trim();
}

export function readKnowledgeSyncConfig(environment: Environment = process.env) {
  return {
    serverUrl: parseServerUrl(environment.KNOWLEDGE_SYNC_URL),
    token: required(environment.KNOWLEDGE_SYNC_TOKEN),
    vaultId: required(environment.KNOWLEDGE_SYNC_VAULT_ID),
    vaultPath: required(environment.KNOWLEDGE_SYNC_VAULT_PATH),
    ignorePatterns: (environment.KNOWLEDGE_SYNC_IGNORE_PATTERNS ?? "").split(/[\n,]+/).map((value) => value.trim()).filter(Boolean),
  } satisfies KnowledgeSyncConfig;
}

export async function syncKnowledge(config: KnowledgeSyncConfig, scan: Scanner, fetcher: Fetcher = (request) => fetch(request)) {
  const snapshot = await scan(config.vaultPath, config.ignorePatterns);
  const endpoint = new URL(`/api/sync/knowledge/vaults/${encodeURIComponent(config.vaultId)}`, config.serverUrl);
  const response = await fetcher(new Request(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
    body: JSON.stringify(snapshot),
  }));
  if (!response.ok) throw new Error("Knowledge sync failed");
  try {
    return summarySchema.parse((await response.json()).summary);
  } catch {
    throw new Error("Knowledge sync failed");
  }
}
