import { describe, expect, it } from "vitest";

import {
  aiProviderInputSchema,
  aiUseCaseDefaultsSchema,
} from "../src/lib/validators/ai-providers";

describe("AI provider configuration", () => {
  it("normalizes URLs, endpoints, environment references, and manual models", () => {
    expect(aiProviderInputSchema.parse({
      name: "  Local OpenAI  ",
      adapterKind: "OPENAI_COMPATIBLE",
      baseUrl: "http://127.0.0.1:11434/v1/",
      generationEndpoint: "chat/completions",
      modelEndpoint: "/models",
      authType: "BEARER",
      authScheme: "Bearer",
      credentialEnvVar: "  LOCAL_AI_KEY  ",
      enabled: false,
      manualModels: [" qwen3 ", "qwen3", "deepseek-r1"],
    })).toMatchObject({
      name: "Local OpenAI",
      baseUrl: "http://127.0.0.1:11434/v1",
      generationEndpoint: "/chat/completions",
      modelEndpoint: "/models",
      credentialEnvVar: "LOCAL_AI_KEY",
      manualModels: ["qwen3", "deepseek-r1"],
    });
  });

  it.each([
    "ftp://models.example.com",
    "https://user:secret@models.example.com",
    "models.example.com",
  ])("rejects an unsafe base URL: %s", (baseUrl) => {
    expect(aiProviderInputSchema.safeParse({
      name: "Unsafe",
      adapterKind: "OPENAI_COMPATIBLE",
      baseUrl,
      generationEndpoint: "/chat/completions",
      authType: "NONE",
      enabled: false,
      manualModels: [],
    }).success).toBe(false);
  });

  it("requires a credential environment variable for authenticated providers", () => {
    expect(aiProviderInputSchema.safeParse({
      name: "Missing secret reference",
      adapterKind: "ANTHROPIC_MESSAGES",
      baseUrl: "https://api.anthropic.com",
      generationEndpoint: "/v1/messages",
      authType: "X_API_KEY",
      enabled: false,
      manualModels: [],
    }).success).toBe(false);
  });

  it("requires declarative mappings for custom JSON without accepting absolute endpoints", () => {
    const base = {
      name: "Custom JSON",
      adapterKind: "CUSTOM_JSON",
      baseUrl: "https://models.example.com",
      generationEndpoint: "https://attacker.example.com/generate",
      authType: "CUSTOM_HEADER",
      authHeaderName: "x-api-key",
      credentialEnvVar: "CUSTOM_AI_KEY",
      enabled: false,
      manualModels: [],
      adapterConfig: {
        headers: { "x-client": "workstation" },
        requestTemplate: { model: "${model}", input: "${prompt}" },
        responseTextPath: "result.text",
      },
    };

    expect(aiProviderInputSchema.safeParse(base).success).toBe(false);
    expect(aiProviderInputSchema.safeParse({ ...base, generationEndpoint: "/generate" }).success).toBe(true);
    expect(aiProviderInputSchema.safeParse({ ...base, generationEndpoint: "/generate", adapterConfig: undefined }).success).toBe(false);
  });
});

describe("AI use-case defaults", () => {
  it("accepts only the three approved use cases and non-empty model IDs", () => {
    expect(aiUseCaseDefaultsSchema.parse({ defaults: [
      { useCase: "PROJECT_DESCRIPTION", providerId: "provider-1", model: "gpt-5-mini" },
      { useCase: "WEEKLY_UPDATE", providerId: "provider-1", model: "gpt-5-mini" },
      { useCase: "OKR_REVIEW", providerId: "provider-2", model: "claude-sonnet" },
    ] }).defaults).toHaveLength(3);

    expect(aiUseCaseDefaultsSchema.safeParse({ defaults: [
      { useCase: "GENERAL_CHAT", providerId: "provider-1", model: "gpt-5-mini" },
    ] }).success).toBe(false);
  });
});
