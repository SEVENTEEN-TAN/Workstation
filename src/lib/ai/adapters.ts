import { customJsonAdapterConfigSchema } from "../validators/ai-providers";
import { readJsonPath, renderJsonTemplate } from "./declarative-json";

export const AI_REQUEST_TIMEOUT_MS = 20_000;

export type AiProviderRuntime = {
  adapterKind: string;
  baseUrl: string;
  generationEndpoint: string;
  modelEndpoint?: string | null;
  authType: string;
  authHeaderName?: string | null;
  authScheme?: string | null;
  credentialEnvVar?: string | null;
  adapterConfig: unknown;
  manualModels: unknown;
};

export type AiGenerationInput = {
  model: string;
  system: string;
  prompt: string;
};

export type AiGenerationResult = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type AiAdapter = {
  buildGenerationRequest(provider: AiProviderRuntime, input: AiGenerationInput, credential: string): Request;
  readGenerationResponse(payload: unknown): AiGenerationResult;
  buildModelRequest(provider: AiProviderRuntime, credential: string): Request | null;
  readModels(payload: unknown): string[];
};

function request(url: string, init: RequestInit) {
  return new Request(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });
}

function endpointUrl(provider: AiProviderRuntime, endpoint: string) {
  return endpoint.startsWith("/")
    ? `${provider.baseUrl}${endpoint}`
    : new URL(endpoint, provider.baseUrl).toString();
}

function authHeaders(provider: AiProviderRuntime, credential: string): Record<string, string> {
  if (provider.authType === "NONE") return {};
  if (provider.authType === "BEARER") {
    return { authorization: `${provider.authScheme || "Bearer"} ${credential}` };
  }
  if (provider.authType === "X_API_KEY") return { "x-api-key": credential };
  return { [provider.authHeaderName || "x-api-key"]: credential };
}

function jsonHeaders(provider: AiProviderRuntime, credential: string, method: "GET" | "POST") {
  return {
    accept: "application/json",
    ...(method === "POST" ? { "content-type": "application/json" } : {}),
    ...authHeaders(provider, credential),
  };
}

function messages(input: AiGenerationInput) {
  return [
    { role: "system", content: input.system },
    { role: "user", content: input.prompt },
  ];
}

function requiredString(value: unknown, path: string) {
  const result = readJsonPath(value, path);
  if (typeof result !== "string") throw new Error("AI response is invalid");
  return result;
}

function optionalToken(payload: unknown, path: string | undefined) {
  if (!path) return null;
  const value = readJsonPath(payload, path);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function modelsFromList(payload: unknown, listPath: string, idPath?: string) {
  const list = readJsonPath(payload, listPath);
  if (!Array.isArray(list)) throw new Error("AI model response is invalid");
  return list
    .map((item) => idPath ? readJsonPath(item, idPath) : item)
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

const openAiAdapter: AiAdapter = {
  buildGenerationRequest(provider, input, credential) {
    return request(endpointUrl(provider, provider.generationEndpoint), {
      method: "POST",
      headers: jsonHeaders(provider, credential, "POST"),
      body: JSON.stringify({ model: input.model, messages: messages(input) }),
    });
  },
  readGenerationResponse(payload) {
    return {
      text: requiredString(payload, "choices.0.message.content"),
      inputTokens: optionalToken(payload, "usage.prompt_tokens"),
      outputTokens: optionalToken(payload, "usage.completion_tokens"),
    };
  },
  buildModelRequest(provider, credential) {
    if (!provider.modelEndpoint) return null;
    return request(endpointUrl(provider, provider.modelEndpoint), {
      method: "GET",
      headers: jsonHeaders(provider, credential, "GET"),
    });
  },
  readModels(payload) {
    return modelsFromList(payload, "data", "id");
  },
};

const anthropicAdapter: AiAdapter = {
  buildGenerationRequest(provider, input, credential) {
    return request(endpointUrl(provider, provider.generationEndpoint), {
      method: "POST",
      headers: {
        ...jsonHeaders(provider, credential, "POST"),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 4096,
        system: input.system,
        messages: [{ role: "user", content: input.prompt }],
      }),
    });
  },
  readGenerationResponse(payload) {
    return {
      text: requiredString(payload, "content.0.text"),
      inputTokens: optionalToken(payload, "usage.input_tokens"),
      outputTokens: optionalToken(payload, "usage.output_tokens"),
    };
  },
  buildModelRequest(provider, credential) {
    if (!provider.modelEndpoint) return null;
    return request(endpointUrl(provider, provider.modelEndpoint), {
      method: "GET",
      headers: {
        ...jsonHeaders(provider, credential, "GET"),
        "anthropic-version": "2023-06-01",
      },
    });
  },
  readModels(payload) {
    return modelsFromList(payload, "data", "id");
  },
};

function customConfig(provider: AiProviderRuntime) {
  const parsed = customJsonAdapterConfigSchema.safeParse(provider.adapterConfig);
  if (!parsed.success) throw new Error("AI provider configuration is invalid");
  return parsed.data;
}

function customJsonAdapter(provider: AiProviderRuntime): AiAdapter {
  const config = customConfig(provider);
  return {
    buildGenerationRequest(currentProvider, input, credential) {
      const headers = renderJsonTemplate(config.headers, {
        credential,
        model: input.model,
        system: input.system,
        prompt: input.prompt,
      }) as Record<string, string>;
      return request(endpointUrl(currentProvider, currentProvider.generationEndpoint), {
        method: "POST",
        headers,
        body: JSON.stringify(renderJsonTemplate(config.requestTemplate, input)),
      });
    },
    readGenerationResponse(payload) {
      return {
        text: requiredString(payload, config.responseTextPath),
        inputTokens: optionalToken(payload, config.inputTokensPath),
        outputTokens: optionalToken(payload, config.outputTokensPath),
      };
    },
    buildModelRequest(currentProvider, credential) {
      if (!currentProvider.modelEndpoint) return null;
      const headers = renderJsonTemplate(config.headers, {
        credential,
        model: "",
        system: "",
        prompt: "",
      }) as Record<string, string>;
      return request(endpointUrl(currentProvider, currentProvider.modelEndpoint), {
        method: "GET",
        headers,
      });
    },
    readModels(payload) {
      return modelsFromList(payload, config.modelListPath || "models", config.modelIdPath);
    },
  };
}

export function getAiAdapter(provider: AiProviderRuntime): AiAdapter {
  if (provider.adapterKind === "OPENAI_COMPATIBLE") return openAiAdapter;
  if (provider.adapterKind === "ANTHROPIC_MESSAGES") return anthropicAdapter;
  if (provider.adapterKind === "CUSTOM_JSON") return customJsonAdapter(provider);
  throw new Error("Unsupported AI provider");
}
