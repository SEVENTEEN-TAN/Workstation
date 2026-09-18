import {
  AI_REQUEST_TIMEOUT_MS,
  getAiAdapter,
  type AiGenerationInput,
  type AiProviderRuntime,
} from "./adapters";

export { AI_REQUEST_TIMEOUT_MS };

export type AiFetcher = (request: Request) => Promise<Response>;

function credential(provider: AiProviderRuntime) {
  if (provider.authType === "NONE") return "";
  const value = provider.credentialEnvVar ? process.env[provider.credentialEnvVar] : undefined;
  if (!value?.trim()) throw new Error("AI provider credential is not configured");
  return value;
}

async function sendJson(request: Request, fetcher: AiFetcher) {
  try {
    const response = await fetcher(request);
    if (!response.ok) throw new Error();
    return await response.json();
  } catch {
    throw new Error("AI provider request failed");
  }
}

function normalizeModels(...groups: unknown[]) {
  const models = groups.flatMap((group) => Array.isArray(group) ? group : []);
  return [...new Set(models.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim()))].sort((left, right) => left.localeCompare(right));
}

export async function generateAiText(
  provider: AiProviderRuntime,
  input: AiGenerationInput,
  fetcher: AiFetcher = (request) => fetch(request),
) {
  const adapter = getAiAdapter(provider);
  const request = adapter.buildGenerationRequest(provider, input, credential(provider));
  return adapter.readGenerationResponse(await sendJson(request, fetcher));
}

export async function discoverProviderModels(
  provider: AiProviderRuntime,
  fetcher: AiFetcher = (request) => fetch(request),
) {
  const adapter = getAiAdapter(provider);
  const request = adapter.buildModelRequest(provider, credential(provider));
  const discovered = request ? adapter.readModels(await sendJson(request, fetcher)) : [];
  return normalizeModels(provider.manualModels, discovered);
}
