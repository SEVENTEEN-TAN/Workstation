import type { Prisma } from "@prisma/client";

import { getDatabase } from "../db";
import { generateAiText, discoverProviderModels, type AiFetcher } from "../ai/runtime";
import {
  aiProviderInputSchema,
  aiUseCaseDefaultsSchema,
} from "../validators/ai-providers";

export type AiProviderRecord = {
  id: string;
  name: string;
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
  cachedModels: unknown;
  enabled: boolean;
  lastTestStatus: string;
  lastTestedAt: Date | null;
  lastTestError: string | null;
  modelsRefreshedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  defaults?: unknown[];
  requestLogs?: unknown[];
};

export type AiProviderState = {
  providers: Array<Omit<AiProviderRecord, "credentialEnvVar"> & { credentialConfigured: boolean }>;
  defaults: unknown[];
  requestLogs: unknown[];
};

export type AiProviderServiceRepository = {
  listState(): Promise<Omit<AiProviderState, "providers"> & {
    providers: AiProviderRecord[];
  }>;
  findProvider(id: string): Promise<AiProviderRecord | null>;
  createProvider(value: Record<string, unknown>): Promise<AiProviderRecord>;
  updateProvider(id: string, value: Record<string, unknown>): Promise<AiProviderRecord>;
  replaceDefaults(value: Array<{ useCase: string; providerId: string; model: string }>): Promise<unknown>;
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

const connectionFields = [
  "adapterKind",
  "baseUrl",
  "generationEndpoint",
  "modelEndpoint",
  "authType",
  "authHeaderName",
  "authScheme",
  "credentialEnvVar",
  "adapterConfig",
] as const;

function modelList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function credentialConfigured(provider: AiProviderRecord) {
  if (provider.authType === "NONE") return true;
  return Boolean(provider.credentialEnvVar && process.env[provider.credentialEnvVar]?.trim());
}

function publicProvider(provider: AiProviderRecord): Omit<AiProviderRecord, "credentialEnvVar"> & { credentialConfigured: boolean } {
  const result = { ...provider, credentialConfigured: credentialConfigured(provider) };
  delete (result as Partial<AiProviderRecord>).credentialEnvVar;
  return result;
}

function createData(input: Record<string, unknown>) {
  return {
    ...input,
    cachedModels: [],
    enabled: false,
    lastTestStatus: "NEVER",
    lastTestedAt: null,
    lastTestError: null,
    modelsRefreshedAt: null,
  };
}

function safeFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const known = [
    "AI provider credential is not configured",
    "AI provider request failed",
    "AI provider configuration is invalid",
    "AI response is invalid",
    "Unsupported AI provider",
    "AI provider model is unavailable",
  ];
  return known.includes(message) ? message : "AI provider test failed";
}

function defaultRepository(): AiProviderServiceRepository {
  return {
    async listState() {
      const database = await getDatabase();
      const [providers, defaults, requestLogs] = await Promise.all([
        database.aiProvider.findMany({
          include: { defaults: true },
          orderBy: { name: "asc" },
        }),
        database.aiUseCaseSetting.findMany({ orderBy: { useCase: "asc" } }),
        database.aiRequestLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
      ]);
      return { providers, defaults, requestLogs };
    },
    async findProvider(id) {
      return (await getDatabase()).aiProvider.findUnique({ where: { id } });
    },
    async createProvider(value) {
      return (await getDatabase()).aiProvider.create({
        data: createData(value) as unknown as Prisma.AiProviderUncheckedCreateInput,
      });
    },
    async updateProvider(id, value) {
      return (await getDatabase()).aiProvider.update({
        where: { id },
        data: value as Prisma.AiProviderUncheckedUpdateInput,
      });
    },
    async replaceDefaults(value) {
      const database = await getDatabase();
      return database.$transaction(async (transaction) => {
        await transaction.aiUseCaseSetting.deleteMany({});
        await transaction.aiUseCaseSetting.createMany({
          data: value.map((item) => ({ ...item })),
        });
        return transaction.aiUseCaseSetting.findMany({ orderBy: { useCase: "asc" } });
      });
    },
    async recordRequestLog(value) {
      return (await getDatabase()).aiRequestLog.create({ data: value });
    },
  };
}

export function createAiProviderService(repository: AiProviderServiceRepository = defaultRepository()) {
  return {
    async listState(): Promise<AiProviderState> {
      const state = await repository.listState();
      return {
        ...state,
        providers: state.providers.map(publicProvider),
      };
    },

    save(input: unknown) {
      const value = aiProviderInputSchema.parse(input);
      return repository.createProvider(createData(value)).then(publicProvider);
    },

    async update(id: string, input: unknown) {
      const current = await repository.findProvider(id);
      if (!current) throw new Error("AI provider not found");
      const rawInput = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const value = aiProviderInputSchema.parse({
        ...rawInput,
        credentialEnvVar: Object.hasOwn(rawInput, "credentialEnvVar")
          ? rawInput.credentialEnvVar
          : rawInput.authType === "NONE"
            ? null
            : current.credentialEnvVar,
      });
      const connectionChanged = connectionFields.some((field) => {
        const before = current[field] as unknown;
        return JSON.stringify(before) !== JSON.stringify(value[field]);
      });
      if (value.enabled && (connectionChanged || current.lastTestStatus !== "SUCCESS")) {
        throw new Error("AI provider must pass a connection test before activation");
      }
      const next = {
        ...value,
        ...(connectionChanged ? {
          enabled: false,
          lastTestStatus: "NEVER",
          lastTestedAt: null,
          lastTestError: null,
          modelsRefreshedAt: null,
          cachedModels: [],
        } : {}),
      };
      return repository.updateProvider(id, next).then(publicProvider);
    },

    async test(id: string, fetcher?: AiFetcher) {
      const current = await repository.findProvider(id);
      if (!current) throw new Error("AI provider not found");
      const model = modelList(current.cachedModels)[0] || modelList(current.manualModels)[0];
      if (!model) throw new Error("AI provider model is unavailable");

      const startedAt = Date.now();
      try {
        const result = await generateAiText(current, {
          model,
          system: "You are a connection tester.",
          prompt: "Reply with OK.",
        }, fetcher);
        const latencyMs = Date.now() - startedAt;
        const testedAt = new Date();
        const [updated] = await Promise.all([
          repository.updateProvider(id, {
            lastTestStatus: "SUCCESS",
            lastTestedAt: testedAt,
            lastTestError: null,
          }),
          repository.recordRequestLog({
            providerId: id,
            useCase: "CONNECTION_TEST",
            model,
            latencyMs,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            outcome: "SUCCESS",
            failureReason: null,
          }),
        ]);
        return publicProvider(updated);
      } catch (error) {
        const failureReason = safeFailureMessage(error);
        const latencyMs = Date.now() - startedAt;
        await Promise.all([
          repository.updateProvider(id, {
            enabled: false,
            lastTestStatus: "FAILED",
            lastTestedAt: new Date(),
            lastTestError: failureReason,
          }),
          repository.recordRequestLog({
            providerId: id,
            useCase: "CONNECTION_TEST",
            model,
            latencyMs,
            inputTokens: null,
            outputTokens: null,
            outcome: "FAILED",
            failureReason,
          }),
        ]);
        throw new Error(failureReason);
      }
    },

    async refreshModels(id: string, fetcher?: AiFetcher) {
      const current = await repository.findProvider(id);
      if (!current) throw new Error("AI provider not found");
      const models = await discoverProviderModels(current, fetcher);
      await repository.updateProvider(id, {
        cachedModels: models,
        modelsRefreshedAt: new Date(),
      });
      return models;
    },

    async saveDefaults(input: unknown) {
      const value = aiUseCaseDefaultsSchema.parse(input).defaults;
      const providers = new Map<string, AiProviderRecord>();
      for (const id of [...new Set(value.map((item) => item.providerId))]) {
        const provider = await repository.findProvider(id);
        if (!provider) throw new Error("AI provider not found");
        if (!provider.enabled || provider.lastTestStatus !== "SUCCESS") {
          throw new Error("AI provider is not active");
        }
        providers.set(id, provider);
      }
      for (const item of value) {
        const available = [...modelList(providers.get(item.providerId)?.manualModels), ...modelList(providers.get(item.providerId)?.cachedModels)];
        if (!available.includes(item.model)) throw new Error("AI model is unavailable");
      }
      return repository.replaceDefaults(value);
    },
  };
}

export const aiProviderService = createAiProviderService();
