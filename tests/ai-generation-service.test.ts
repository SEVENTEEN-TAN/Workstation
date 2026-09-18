import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createAiGenerationService, type AiGenerationRepository } from "../src/lib/services/ai-generation";

const provider = {
  id: "provider-1",
  adapterKind: "OPENAI_COMPATIBLE",
  baseUrl: "https://models.example.com/v1",
  generationEndpoint: "/chat/completions",
  modelEndpoint: "/models",
  authType: "NONE",
  authHeaderName: null,
  authScheme: null,
  credentialEnvVar: null,
  adapterConfig: {},
  manualModels: ["model-1"],
  enabled: true,
  lastTestStatus: "SUCCESS",
};

function repository(setting: unknown = { useCase: "PROJECT_DESCRIPTION", model: "model-1", provider }) {
  const logs: unknown[] = [];
  const repo: AiGenerationRepository & { logs: unknown[] } = {
    logs,
    async findSetting() { return setting as never; },
    async recordRequestLog(value) { logs.push(value); return value; },
  };
  return repo;
}

describe("AI generation service", () => {
  it("resolves the configured default, parses fenced JSON, and logs only metadata", async () => {
    const repo = repository();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "```json\n{\"summaryZh\":\"完成\"}\n```" } }],
      usage: { prompt_tokens: 12, completion_tokens: 4 },
    }), { headers: { "content-type": "application/json" } }));
    const service = createAiGenerationService(repo);

    await expect(service.generate("PROJECT_DESCRIPTION", {
      system: "private system prompt",
      prompt: "private source content",
      schema: z.object({ summaryZh: z.string() }),
      fetcher,
    })).resolves.toMatchObject({ content: { summaryZh: "完成" }, providerId: "provider-1", model: "model-1" });

    expect(repo.logs[0]).toMatchObject({
      providerId: "provider-1", useCase: "PROJECT_DESCRIPTION", model: "model-1",
      inputTokens: 12, outputTokens: 4, outcome: "SUCCESS", failureReason: null,
    });
    expect(JSON.stringify(repo.logs)).not.toContain("private system prompt");
    expect(JSON.stringify(repo.logs)).not.toContain("private source content");
  });

  it("rejects an unavailable default before calling the provider", async () => {
    const fetcher = vi.fn();
    const service = createAiGenerationService(repository(null));
    await expect(service.generate("PROJECT_DESCRIPTION", {
      system: "system", prompt: "source", schema: z.object({ value: z.string() }), fetcher,
    })).rejects.toThrow("AI 用例尚未配置默认模型");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("logs a bounded failure reason without storing invalid model output", async () => {
    const repo = repository();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: "not-json-with-private-data" } }],
    }), { headers: { "content-type": "application/json" } }));
    const service = createAiGenerationService(repo);

    await expect(service.generate("PROJECT_DESCRIPTION", {
      system: "system", prompt: "source", schema: z.object({ value: z.string() }), fetcher,
    })).rejects.toThrow("AI 返回内容格式无效");
    expect(repo.logs[0]).toMatchObject({ outcome: "FAILED", failureReason: "AI 返回内容格式无效" });
    expect(JSON.stringify(repo.logs)).not.toContain("not-json-with-private-data");
  });
});
