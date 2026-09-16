import { isAbsolute } from "node:path";
import { z } from "zod";

const ignorePatternSchema = z.string().trim().max(200);

export const knowledgeVaultInputSchema = z.object({
  name: z.string().trim().min(1, "知识库名称不能为空").max(120),
  rootPath: z.string().trim().min(1, "知识库路径不能为空").max(1_000)
    .refine(isAbsolute, "知识库路径必须是本机绝对路径"),
  ignorePatterns: z.array(ignorePatternSchema).max(50).default([]),
  enabled: z.boolean().default(true),
}).transform((value) => ({
  ...value,
  ignorePatterns: [...new Set(value.ignorePatterns.filter(Boolean))],
}));

export const knowledgeVaultPatchSchema = z.object({
  name: z.string().trim().min(1, "知识库名称不能为空").max(120).optional(),
  rootPath: z.string().trim().min(1, "知识库路径不能为空").max(1_000)
    .refine(isAbsolute, "知识库路径必须是本机绝对路径")
    .optional(),
  ignorePatterns: z.array(ignorePatternSchema).max(50).optional(),
  enabled: z.boolean().optional(),
});
