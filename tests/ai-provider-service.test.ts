import { afterEach, describe, expect, it, vi } from "vitest";

import { createAiProviderService, type AiProviderServiceRepository } from "../src/lib/services/ai-providers";

const provider = {
  id: "provider-1",
  name: "Local OpenAI",
  adapterKind: "OPENAI_COMPATIBLE",
  baseUrl: "https://models.example.com/v1",
  generationEndpoint: "/chat/completions",
  modelEndpoint: "/models",
  authType: "BEARER",
  authHeaderName: null,
  authScheme: "Bearer",
  credentialEnvVar: "WORKSTATION_TEST_AI_KEY",
  adapterConfig: {},
  manualModels: ["manual-model"],
  cachedModels: [],
  enabled: false,
  lastTestStatus: "NEVER",
  lastTestedAt: null,
  lastTestError: null,
  modelsRefreshedAt: null,
  createdAt: new Date("2026-09-18T00:00:00.000Z"),
  updatedAt: new Date("2026-09-18T00:00:00.000Z"),
  defaults: [],
  requestLogs: [],
};

function repository(current = provider): AiProviderServiceRepository & {
  created: unknown;
  updated: unknown[];
  logs: unknown[];
  defaults: unknown;
} {
  const state = {
    created: null,
    updated: [] as unknown[],
    logs: [] as unknown[],
    defaults: null,
  };

  return {
    get created() { return state.created; },
    get updated() { return state.updated; },
    get logs() { return state.logs; },
    get defaults() { return state.defaults; },
    async listState() {
      return {
        providers: [{ ...current, credentialConfigured: true }],
        defaults: [],
        requestLogs: [],
      };
    },
    async findProvider() { return current; },
    async createProvider(value) { state.created = value; return { ...provider, ...value }; },
    async updateProvider(_id, value) { state.updated.push(value); return { ...current, ...value }; },
    async replaceDefaults(value) { state.defaults = value; return value; },
    async recordRequestLog(value) { state.logs.push(value); return value; },
  };
}

describe("AI provider service", () => {
  afterEach(() => {
    delete process.env.WORKSTATION_TEST_AI_KEY;
  });

  it("saves a disabled provider and requires a successful test before activation", async () => {
    const repo = repository();
    const service = createAiProviderService(repo);

    const saved = await service.save({
      ...provider,
      enabled: true,
      manualModels: ["manual-model", "manual-model"],
    });

    expect(saved).toMatchObject({ enabled: false, manualModels: ["manual-model"] });
    expect(saved).not.toHaveProperty("credentialEnvVar");
    expect(repo.created).toMatchObject({
      enabled: false,
      lastTestStatus: "NEVER",
      credentialEnvVar: "WORKSTATION_TEST_AI_KEY",
    });
  });

  it("does not expose credential references and preserves them when an edit omits the field", async () => {
    process.env.WORKSTATION_TEST_AI_KEY = "provider-secret";
    const repo = repository({ ...provider, lastTestStatus: "SUCCESS" });
    const service = createAiProviderService(repo);

    const state = await service.listState();
    expect(state.providers[0]).toMatchObject({ credentialConfigured: true });
    expect(state.providers[0]).not.toHaveProperty("credentialEnvVar");

    const editableProvider = { ...provider } as Partial<typeof provider>;
    delete editableProvider.credentialEnvVar;
    const updated = await service.update("provider-1", {
      ...editableProvider,
      name: "Renamed provider",
    });

    expect(repo.updated[0]).toMatchObject({
      name: "Renamed provider",
      credentialEnvVar: "WORKSTATION_TEST_AI_KEY",
    });
    expect(updated).not.toHaveProperty("credentialEnvVar");
  });

  it("returns the admin state as JSON-safe views without credential references", async () => {
    const timestamp = new Date("2026-09-18T03:00:00.000Z");
    const repo = repository({
      ...provider,
      lastTestStatus: "SUCCESS",
      lastTestedAt: timestamp,
      lastTestError: null,
      modelsRefreshedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    repo.listState = vi.fn(async () => ({
      providers: [{
        ...provider,
        lastTestStatus: "SUCCESS",
        lastTestedAt: timestamp,
        modelsRefreshedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      }],
      defaults: [{ useCase: "PROJECT_DESCRIPTION", providerId: "provider-1", model: "manual-model", createdAt: timestamp, updatedAt: timestamp }],
      requestLogs: [{
        id: "log-1", providerId: "provider-1", useCase: "CONNECTION_TEST", model: "manual-model",
        latencyMs: 120, inputTokens: 3, outputTokens: 1, outcome: "SUCCESS", failureReason: null, createdAt: timestamp,
      }],
    }));

    await expect(createAiProviderService(repo).listState()).resolves.toEqual({
      providers: [{
        id: "provider-1",
        name: "Local OpenAI",
        adapterKind: "OPENAI_COMPATIBLE",
        baseUrl: "https://models.example.com/v1",
        generationEndpoint: "/chat/completions",
        modelEndpoint: "/models",
        authType: "BEARER",
        authHeaderName: null,
        authScheme: "Bearer",
        adapterConfig: {},
        manualModels: ["manual-model"],
        cachedModels: [],
        enabled: false,
        lastTestStatus: "SUCCESS",
        lastTestedAt: "2026-09-18T03:00:00.000Z",
        modelsRefreshedAt: "2026-09-18T03:00:00.000Z",
        credentialConfigured: false,
        createdAt: "2026-09-18T03:00:00.000Z",
        updatedAt: "2026-09-18T03:00:00.000Z",
      }],
      defaults: [{
        useCase: "PROJECT_DESCRIPTION", providerId: "provider-1", model: "manual-model",
        createdAt: "2026-09-18T03:00:00.000Z", updatedAt: "2026-09-18T03:00:00.000Z",
      }],
      requestLogs: [{
        id: "log-1", providerId: "provider-1", useCase: "CONNECTION_TEST", model: "manual-model",
        latencyMs: 120, inputTokens: 3, outputTokens: 1, outcome: "SUCCESS", failureReason: null,
        createdAt: "2026-09-18T03:00:00.000Z",
      }],
    });
  });

  it("records a successful connection test without persisting prompts or responses", async () => {
    process.env.WORKSTATION_TEST_AI_KEY = "provider-secret";
    const repo = repository({ ...provider, cachedModels: ["cached-model"] });
    const service = createAiProviderService(repo);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "OK" } }],
      usage: { prompt_tokens: 3, completion_tokens: 1 },
    }), { headers: { "content-type": "application/json" } }));

    await expect(service.test("provider-1", fetcher)).resolves.toMatchObject({
      lastTestStatus: "SUCCESS",
      enabled: false,
    });
    expect(repo.updated[0]).toMatchObject({
      lastTestStatus: "SUCCESS",
      lastTestError: null,
    });
    expect(repo.logs[0]).toMatchObject({
      providerId: "provider-1",
      useCase: "CONNECTION_TEST",
      model: "cached-model",
      inputTokens: 3,
      outputTokens: 1,
      outcome: "SUCCESS",
      failureReason: null,
    });
    expect(JSON.stringify(repo.logs)).not.toContain("provider-secret");
    expect(JSON.stringify(repo.logs)).not.toContain("Reply");
  });

  it("marks failed tests and stores only a bounded sanitized reason", async () => {
    process.env.WORKSTATION_TEST_AI_KEY = "provider-secret";
    const repo = repository();
    const service = createAiProviderService(repo);
    const fetcher = vi.fn(async () => new Response("upstream secret provider-secret", { status: 500 }));

    await expect(service.test("provider-1", fetcher)).rejects.toThrow("AI provider request failed");
    expect(repo.updated[0]).toMatchObject({ lastTestStatus: "FAILED", enabled: false });
    expect(repo.logs[0]).toMatchObject({
      outcome: "FAILED",
      failureReason: "AI provider request failed",
    });
    expect(JSON.stringify(repo.logs)).not.toContain("provider-secret");
  });

  it("caches discovered and manual models in normalized order", async () => {
    process.env.WORKSTATION_TEST_AI_KEY = "provider-secret";
    const repo = repository();
    const service = createAiProviderService(repo);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: "z-model" }, { id: "a-model" }, { id: "a-model" }, { id: "manual-model" }],
    }), { headers: { "content-type": "application/json" } }));

    await expect(service.refreshModels("provider-1", fetcher)).resolves.toEqual([
      "a-model",
      "manual-model",
      "z-model",
    ]);
    expect(repo.updated[0]).toMatchObject({
      cachedModels: ["a-model", "manual-model", "z-model"],
      modelsRefreshedAt: expect.any(Date),
    });
  });

  it("requires defaults to use enabled, tested providers and available models", async () => {
    const repo = repository({ ...provider, enabled: true, lastTestStatus: "SUCCESS", cachedModels: ["cached-model"] });
    const service = createAiProviderService(repo);

    await expect(service.saveDefaults({
      defaults: [{ useCase: "PROJECT_DESCRIPTION", providerId: "provider-1", model: "missing-model" }],
    })).rejects.toThrow("AI model is unavailable");

    await expect(service.saveDefaults({
      defaults: [{ useCase: "PROJECT_DESCRIPTION", providerId: "provider-1", model: "cached-model" }],
    })).resolves.toEqual([
      { useCase: "PROJECT_DESCRIPTION", providerId: "provider-1", model: "cached-model" },
    ]);
    expect(repo.defaults).toEqual([
      { useCase: "PROJECT_DESCRIPTION", providerId: "provider-1", model: "cached-model" },
    ]);
  });
});
