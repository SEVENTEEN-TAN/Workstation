import { z } from "zod";
import { readFile, realpath, stat } from "node:fs/promises";
import { basename, dirname, extname, resolve, sep } from "node:path";

import type { VaultScanResult } from "./vault-scanner";
import { articleImageEmbedPath } from "./article-attachments";

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

const attachmentRequestsSchema = z.object({ requests: z.array(z.object({
  id: z.string().min(1),
  target: z.string().min(1),
  sourceRevision: z.object({ relativePath: z.string().min(1) }),
}).strict()) }).strict();

const attachmentMimeTypes: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

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

export async function resolveRequestedAttachment(vaultPath: string, noteRelativePath: string, target: string) {
  const attachmentPath = articleImageEmbedPath(target);
  if (!attachmentPath) return null;
  const root = await realpath(vaultPath);
  const noteDirectory = dirname(noteRelativePath.replace(/\\/g, "/"));
  const candidates = [
    resolve(root, noteDirectory, attachmentPath),
    resolve(root, noteDirectory, "assets", attachmentPath),
    resolve(root, "assets", attachmentPath),
    resolve(root, attachmentPath),
  ];
  const matches: string[] = [];
  for (const candidate of candidates) {
    try {
      const resolved = await realpath(candidate);
      if (!resolved.startsWith(`${root}${sep}`) || !(await stat(resolved)).isFile()) continue;
      if (attachmentMimeTypes[extname(resolved).toLowerCase()] && !matches.includes(resolved)) matches.push(resolved);
    } catch {
      // Missing candidates are expected while checking Obsidian attachment conventions.
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

async function syncRequestedAttachments(config: KnowledgeSyncConfig, fetcher: Fetcher) {
  const endpoint = new URL(`/api/sync/knowledge/vaults/${encodeURIComponent(config.vaultId)}/attachments`, config.serverUrl);
  let response: Response;
  try {
    response = await fetcher(new Request(endpoint, { headers: { authorization: `Bearer ${config.token}` } }));
  } catch {
    throw new Error("Knowledge attachment sync request failed");
  }
  if (!response.ok) throw new Error("Knowledge attachment sync request failed");
  let pending: z.infer<typeof attachmentRequestsSchema>;
  try {
    pending = attachmentRequestsSchema.parse(await response.json());
  } catch {
    throw new Error("Knowledge attachment sync response is invalid");
  }
  for (const request of pending.requests) {
    try {
      const path = await resolveRequestedAttachment(config.vaultPath, request.sourceRevision.relativePath, request.target);
      if (!path) continue;
      const form = new FormData();
      form.set("file", new File([await readFile(path)], basename(path), { type: attachmentMimeTypes[extname(path).toLowerCase()] }));
      const upload = new URL(`/api/sync/knowledge/attachments/${encodeURIComponent(request.id)}`, config.serverUrl);
      const uploaded = await fetcher(new Request(upload, { method: "POST", headers: { authorization: `Bearer ${config.token}` }, body: form }));
      if (!uploaded.ok) throw new Error("Knowledge attachment upload failed");
    } catch {
      throw new Error("Knowledge attachment upload failed");
    }
  }
}

export async function syncKnowledge(config: KnowledgeSyncConfig, scan: Scanner, fetcher: Fetcher = (request) => fetch(request)) {
  const snapshot = await scan(config.vaultPath, config.ignorePatterns);
  const endpoint = new URL(`/api/sync/knowledge/vaults/${encodeURIComponent(config.vaultId)}`, config.serverUrl);
  let response: Response;
  try {
    response = await fetcher(new Request(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
      body: JSON.stringify(snapshot),
    }));
  } catch {
    throw new Error("Knowledge sync request failed");
  }
  if (!response.ok) throw new Error("Knowledge sync request failed");
  let summary: z.infer<typeof summarySchema>;
  try {
    summary = summarySchema.parse((await response.json()).summary);
  } catch {
    throw new Error("Knowledge sync response is invalid");
  }
  await syncRequestedAttachments(config, fetcher);
  return summary;
}
