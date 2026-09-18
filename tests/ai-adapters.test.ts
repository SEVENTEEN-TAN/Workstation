import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AI_REQUEST_TIMEOUT_MS,
  discoverProviderModels,
  generateAiText,
} from "../src/lib/ai/runtime";
import {
  getAiAdapter,
} from "../src/lib/ai/adapters";
import {
  readJsonPath,
  renderJsonTemplate,
} from "../src/lib/ai/declarative-json";

const openAiProvider = {
  adapterKind: "OPENAI_COMPATIBLE",
  baseUrl: "https://api.openai.com/v1",
  generationEndpoint: "/chat/completions",
  modelEndpoint: "/models",
  authType: "BEARER",
  authScheme: "Bearer",
  credentialEnvVar: "WORKSTATION_TEST_AI_KEY",
  adapterConfig: {},
  manualModels: [],
};

const anthropicProvider = {
  adapterKind: "ANTHROPIC_MESSAGES",
  baseUrl: "https://api.anthropic.com",
  generationEndpoint: "/v1/messages",
  modelEndpoint: "/v1/models",
  authType: "X_API_KEY",
  credentialEnvVar: "WORKSTATION_TEST_AI_KEY",
  adapterConfig: {},
  manualModels: [],
};

const customProvider = {
  adapterKind: "CUSTOM_JSON",
  baseUrl: "https://models.example.com",
  generationEndpoint: "/generate",
  modelEndpoint: "/model-list",
  authType: "CUSTOM_HEADER",
  authHeaderName: "x-api-key",
  credentialEnvVar: "WORKSTATION_TEST_AI_KEY",
  adapterConfig: {
    headers: { "x-client": "workstation", "x-api-key": "${credential}" },
    requestTemplate: {
      model: "${model}",
      messages: [
        { role: "system", content: "${system}" },
        { role: "user", content: "${prompt}" },
      ],
    },
    responseTextPath: "result.0.text",
    inputTokensPath: "usage.input",
    outputTokensPath: "usage.output",
    modelListPath: "data.models",
    modelIdPath: "id",
  },
  manualModels: ["manual-model"],
};

const input = {
  model: "gpt-5-mini",
  system: "You are concise.",
  prompt: "Summarize this project.",
};

function captureRequest(payload: unknown, status = 200) {
  const fetcher = vi.fn(async (request: Request) => new Response(
    status === 200 ? JSON.stringify(payload) : "{}",
    { status, headers: { "content-type": "application/json" } },
  ));
  return fetcher;
}

describe("AI adapters", () => {
  afterEach(() => {
    delete process.env.WORKSTATION_TEST_AI_KEY;
  });

  it("builds and reads OpenAI-compatible requests", async () => {
    process.env.WORKSTATION_TEST_AI_KEY = "openai-secret";
    const request = getAiAdapter(openAiProvider).buildGenerationRequest(
      openAiProvider,
      input,
      "openai-secret",
    );

    expect(request.method).toBe("POST");
    expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(request.headers.get("authorization")).toBe("Bearer openai-secret");
    expect(await request.json()).toEqual({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "You are concise." },
        { role: "user", content: "Summarize this project." },
      ],
    });
    expect(getAiAdapter(openAiProvider).readGenerationResponse({
      choices: [{ message: { content: "Generated text" } }],
      usage: { prompt_tokens: 12, completion_tokens: 7 },
    })).toEqual({ text: "Generated text", inputTokens: 12, outputTokens: 7 });
  });

  it("builds and reads Anthropic Messages requests", async () => {
    const request = getAiAdapter(anthropicProvider).buildGenerationRequest(
      anthropicProvider,
      { ...input, model: "claude-sonnet" },
      "anthropic-secret",
    );

    expect(request.url).toBe("https://api.anthropic.com/v1/messages");
    expect(request.headers.get("x-api-key")).toBe("anthropic-secret");
    expect(request.headers.get("anthropic-version")).toBe("2023-06-01");
    expect(await request.json()).toEqual({
      model: "claude-sonnet",
      max_tokens: 4096,
      system: "You are concise.",
      messages: [{ role: "user", content: "Summarize this project." }],
    });
    expect(getAiAdapter(anthropicProvider).readGenerationResponse({
      content: [{ type: "text", text: "Generated text" }],
      usage: { input_tokens: 15, output_tokens: 9 },
    })).toEqual({ text: "Generated text", inputTokens: 15, outputTokens: 9 });
  });

  it("renders recursive custom JSON and extracts dot-and-index paths", () => {
    expect(renderJsonTemplate(customProvider.adapterConfig.requestTemplate, {
      model: "custom-model",
      system: "Be precise.",
      prompt: "Explain this.",
    })).toEqual({
      model: "custom-model",
      messages: [
        { role: "system", content: "Be precise." },
        { role: "user", content: "Explain this." },
      ],
    });
    expect(() => renderJsonTemplate({ value: "${temperature}" }, {
      model: "custom-model",
      system: "Be precise.",
      prompt: "Explain this.",
    })).toThrow("Unsupported AI template variable");

    expect(readJsonPath({ result: [{ text: "Custom text" }] }, "result.0.text")).toBe("Custom text");
  });

  it("builds custom requests with declarative credential headers", async () => {
    const request = getAiAdapter(customProvider).buildGenerationRequest(
      customProvider,
      { ...input, model: "custom-model" },
      "custom-secret",
    );

    expect(request.url).toBe("https://models.example.com/generate");
    expect(request.headers.get("x-api-key")).toBe("custom-secret");
    expect(request.headers.get("x-client")).toBe("workstation");
    expect(await request.json()).toEqual({
      model: "custom-model",
      messages: [
        { role: "system", content: "You are concise." },
        { role: "user", content: "Summarize this project." },
      ],
    });
    expect(getAiAdapter(customProvider).readGenerationResponse({
      result: [{ text: "Generated text" }],
      usage: { input: 3, output: 5 },
    })).toEqual({ text: "Generated text", inputTokens: 3, outputTokens: 5 });
  });
});

describe("AI runtime", () => {
  afterEach(() => {
    delete process.env.WORKSTATION_TEST_AI_KEY;
  });

  it("sends safe requests and returns generated text", async () => {
    process.env.WORKSTATION_TEST_AI_KEY = "runtime-secret";
    const fetcher = captureRequest({
      choices: [{ message: { content: "Generated text" } }],
      usage: { prompt_tokens: 11, completion_tokens: 6 },
    });

    await expect(generateAiText(openAiProvider, input, fetcher)).resolves.toEqual({
      text: "Generated text",
      inputTokens: 11,
      outputTokens: 6,
    });
    const request = fetcher.mock.calls[0][0] as Request;
    expect(request.redirect).toBe("error");
    expect(request.signal.aborted).toBe(false);
    expect(AI_REQUEST_TIMEOUT_MS).toBe(20_000);
  });

  it("requires configured credentials without exposing their values", async () => {
    delete process.env.WORKSTATION_TEST_AI_KEY;

    await expect(generateAiText(openAiProvider, input, captureRequest({})))
      .rejects.toThrow("AI provider credential is not configured");
  });

  it("sanitizes upstream failures", async () => {
    process.env.WORKSTATION_TEST_AI_KEY = "runtime-secret";

    await expect(generateAiText(openAiProvider, input, captureRequest({}, 500)))
      .rejects.toThrow("AI provider request failed");
  });

  it("discovers and normalizes models", async () => {
    process.env.WORKSTATION_TEST_AI_KEY = "runtime-secret";
    const fetcher = captureRequest({ data: { models: [
      { id: "response-model" },
      { id: "response-model" },
      { id: "manual-model" },
    ] } });

    await expect(discoverProviderModels(customProvider, fetcher)).resolves.toEqual([
      "manual-model",
      "response-model",
    ]);
    const request = fetcher.mock.calls[0][0] as Request;
    expect(request.method).toBe("GET");
    expect(request.redirect).toBe("error");
  });

  it.each([
    [openAiProvider, { data: [{ id: "gpt-5-mini" }] }, ["gpt-5-mini"]],
    [anthropicProvider, { data: [{ id: "claude-sonnet" }] }, ["claude-sonnet"]],
  ])("discovers built-in provider models", async (provider, payload, expected) => {
    process.env.WORKSTATION_TEST_AI_KEY = "runtime-secret";

    await expect(discoverProviderModels(provider, captureRequest(payload))).resolves.toEqual(expected);
  });
});
