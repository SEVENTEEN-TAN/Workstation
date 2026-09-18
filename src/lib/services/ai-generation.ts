import type { ZodType } from "zod";

import { generateAiText, type AiFetcher } from "../ai/runtime";
import { getDatabase } from "../db";

export type AiGenerationSetting = {
  useCase: string;
  model: string;
  provider: {
    id: string;
    adapterKind: string;
    baseUrl: string;
    generationEndpoint: string;
    modelEndpoint: string | null;
    authType: string;
    authHeaderName: string | null;
    authScheme: string | null;
    credentialEnvVar: string | null;
    adapterConfig: unknown;
    manualModels: unknown;
    enabled: boolean;
    lastTestStatus: string;
  };
};

export type AiGenerationRepository = {
  findSetting(useCase: string): Promise<AiGenerationSetting | null>;
  recordRequestLog(value: {
    providerId: string | null;
    useCase: string;
    model: string;
    latencyMs: number;
    inputTokens: number | null;
    outputTokens: number | null;
    outcome: string;
    failureReason: string | null;
  }): Promise<unknown>;
};

export type AiGenerateOptions = {
  system: string;
  prompt: string;
  schema: ZodType;
  fetcher?: AiFetcher;
};

export type AiGeneratedValue = {
  content: unknown;
  providerId: string;
  model: string;
};

export type AiGenerator = {
  generate(useCase: string, options: AiGenerateOptions): Promise<AiGeneratedValue>;
};

function defaultRepository(): AiGenerationRepository {
  return {
    findSetting: (useCase) => getDatabase().then((database) => database.aiUseCaseSetting.findUnique({
      where: { useCase }, include: { provider: true },
    })) as Promise<AiGenerationSetting | null>,
    recordRequestLog: (value) => getDatabase().then((database) => database.aiRequestLog.create({ data: value })),
  };
}

function parseJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  try {
    return JSON.parse(fenced ? fenced[1] : trimmed);
  } catch {
    throw new Error("AI 返回内容格式无效");
  }
}

function safeFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const known = [
    "AI provider credential is not configured",
    "AI provider request failed",
    "AI provider configuration is invalid",
    "AI response is invalid",
    "Unsupported AI provider",
    "AI 返回内容格式无效",
  ];
  return known.includes(message) ? message : "AI 生成失败";
}

export function createAiGenerationService(repository: AiGenerationRepository = defaultRepository()): AiGenerator {
  return {
    async generate(useCase, options) {
      const setting = await repository.findSetting(useCase);
      if (!setting) throw new Error("AI 用例尚未配置默认模型");
      if (!setting.provider.enabled || setting.provider.lastTestStatus !== "SUCCESS") {
        throw new Error("AI 默认模型当前不可用");
      }

      const startedAt = Date.now();
      try {
        const result = await generateAiText(setting.provider, {
          model: setting.model,
          system: options.system,
          prompt: options.prompt,
        }, options.fetcher);
        const content = options.schema.parse(parseJson(result.text));
        await repository.recordRequestLog({
          providerId: setting.provider.id,
          useCase,
          model: setting.model,
          latencyMs: Date.now() - startedAt,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          outcome: "SUCCESS",
          failureReason: null,
        });
        return { content, providerId: setting.provider.id, model: setting.model };
      } catch (error) {
        const failureReason = safeFailureMessage(error);
        await repository.recordRequestLog({
          providerId: setting.provider.id,
          useCase,
          model: setting.model,
          latencyMs: Date.now() - startedAt,
          inputTokens: null,
          outputTokens: null,
          outcome: "FAILED",
          failureReason,
        });
        throw new Error(failureReason);
      }
    },
  };
}

export const aiGenerationService = createAiGenerationService();
