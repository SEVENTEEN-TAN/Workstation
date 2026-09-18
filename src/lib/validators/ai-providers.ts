import { z } from "zod";

export const AI_ADAPTER_KINDS = ["OPENAI_COMPATIBLE", "ANTHROPIC_MESSAGES", "CUSTOM_JSON"] as const;
export const AI_AUTH_TYPES = ["NONE", "BEARER", "X_API_KEY", "CUSTOM_HEADER"] as const;
export const AI_USE_CASES = ["PROJECT_DESCRIPTION", "WEEKLY_UPDATE", "OKR_REVIEW"] as const;

const envVarSchema = z.string().trim().regex(/^[A-Z_][A-Z0-9_]*$/, "环境变量名无效");
const modelSchema = z.string().trim().min(1).max(160);
const jsonPathSchema = z.string().trim().regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/, "JSON 路径无效");
const headerNameSchema = z.string().trim().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/, "请求头名称无效");

const baseUrlSchema = z.string().trim().transform((value, context) => {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.toString().replace(/\/$/, "");
  } catch {
    context.addIssue({ code: "custom", message: "基础 URL 必须是无内嵌凭据的 HTTP(S) 地址" });
    return z.NEVER;
  }
});

const endpointSchema = z.string().trim().min(1).refine(
  (value) => !value.includes("://") && !value.startsWith("//") && !value.includes("?") && !value.includes("#"),
  "端点必须是相对路径",
).transform((value) => value.startsWith("/") ? value : `/${value}`);

export const customJsonAdapterConfigSchema = z.object({
  headers: z.record(headerNameSchema, z.string().max(500)).default({}),
  requestTemplate: z.json(),
  responseTextPath: jsonPathSchema,
  inputTokensPath: jsonPathSchema.optional(),
  outputTokensPath: jsonPathSchema.optional(),
  modelListPath: jsonPathSchema.optional(),
  modelIdPath: jsonPathSchema.optional(),
});

export const aiProviderInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  adapterKind: z.enum(AI_ADAPTER_KINDS),
  baseUrl: baseUrlSchema,
  generationEndpoint: endpointSchema,
  modelEndpoint: z.union([endpointSchema, z.literal(""), z.null()]).optional().transform((value) => value || null),
  authType: z.enum(AI_AUTH_TYPES),
  authHeaderName: z.union([headerNameSchema, z.literal(""), z.null()]).optional().transform((value) => value || null),
  authScheme: z.union([z.string().trim().max(40), z.literal(""), z.null()]).optional().transform((value) => value || null),
  credentialEnvVar: z.union([envVarSchema, z.literal(""), z.null()]).optional().transform((value) => value || null),
  enabled: z.boolean().default(false),
  manualModels: z.array(modelSchema).max(100).default([]).transform((items) => [...new Set(items)]),
  adapterConfig: z.unknown().optional(),
}).superRefine((value, context) => {
  if (value.authType !== "NONE" && !value.credentialEnvVar) {
    context.addIssue({ code: "custom", path: ["credentialEnvVar"], message: "认证提供商必须配置密钥环境变量" });
  }
  if (value.authType === "CUSTOM_HEADER" && !value.authHeaderName) {
    context.addIssue({ code: "custom", path: ["authHeaderName"], message: "自定义认证必须配置请求头名称" });
  }
  if (value.adapterKind === "CUSTOM_JSON") {
    const parsed = customJsonAdapterConfigSchema.safeParse(value.adapterConfig);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) context.addIssue({ ...issue, path: ["adapterConfig", ...issue.path] });
    }
  }
}).transform((value) => ({
  ...value,
  authScheme: value.authType === "BEARER" ? value.authScheme || "Bearer" : value.authScheme,
  adapterConfig: value.adapterKind === "CUSTOM_JSON" ? customJsonAdapterConfigSchema.parse(value.adapterConfig) : {},
}));

export const aiUseCaseDefaultsSchema = z.object({
  defaults: z.array(z.object({
    useCase: z.enum(AI_USE_CASES),
    providerId: z.string().trim().min(1),
    model: modelSchema,
  })).max(AI_USE_CASES.length).superRefine((items, context) => {
    const seen = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (seen.has(item.useCase)) context.addIssue({ code: "custom", path: [index, "useCase"], message: "用例不能重复" });
      seen.add(item.useCase);
    }
  }),
});
