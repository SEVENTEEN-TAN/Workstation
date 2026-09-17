import { z } from "zod";

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const dateSchema = z.string().datetime({ offset: true }).transform((value) => new Date(value));

function isSafeRelativePath(value: string) {
  return value.length > 0
    && !value.startsWith("/")
    && !/^[a-z]:/i.test(value)
    && !value.includes("\\")
    && !value.split("/").some((segment) => segment === "." || segment === "..");
}

const relativePathSchema = z.string().min(1).max(1_000).refine(isSafeRelativePath, "路径必须是安全的相对路径");
const markdownPathSchema = relativePathSchema.refine((value) => value.endsWith(".md"), "仅支持 Markdown 笔记");
const directoryPathSchema = z.string().max(1_000).refine((value) => value === "" || isSafeRelativePath(value), "目录必须是安全的相对路径");

const noteSchema = z.object({
  relativePath: markdownPathSchema,
  fileName: z.string().min(1).max(255).regex(/^[^/\\]+\.md$/),
  directoryPath: directoryPathSchema,
  markdown: z.string().max(2 * 1024 * 1024),
  sizeBytes: z.number().int().min(0).max(2 * 1024 * 1024),
  modifiedAt: dateSchema,
  sha256: hashSchema,
  hasFrontmatter: z.boolean(),
  hasWikilinks: z.boolean(),
  hasEmbeds: z.boolean(),
  hasCallouts: z.boolean(),
  hasDataview: z.boolean(),
  hasTasks: z.boolean(),
  isMoc: z.boolean(),
  frontmatter: z.record(z.string(), z.unknown()).nullable(),
}).strict().superRefine((note, context) => {
  const segments = note.relativePath.split("/");
  const expectedDirectory = segments.length === 1 ? "" : segments.slice(0, -1).join("/");
  if (segments.at(-1) !== note.fileName || note.directoryPath !== expectedDirectory) {
    context.addIssue({ code: "custom", message: "笔记路径元数据不一致" });
  }
});

const linkSchema = z.object({
  kind: z.enum(["LINK", "EMBED"]),
  sourceRelativePath: markdownPathSchema,
  targetRaw: z.string().min(1).max(1_000).refine((value) => !/[\r\n]/.test(value)),
  targetRelativePath: relativePathSchema.nullable(),
  targetHeading: z.string().min(1).max(500).nullable(),
  displayLabel: z.string().min(1).max(500).nullable(),
  isResolved: z.boolean(),
}).strict();

export const knowledgeSyncPayloadSchema = z.object({
  scannedAt: dateSchema,
  notes: z.array(noteSchema).max(1_000),
  links: z.array(linkSchema).max(10_000),
}).strict().superRefine((payload, context) => {
  const paths = new Set<string>();
  for (const note of payload.notes) {
    if (paths.has(note.relativePath)) context.addIssue({ code: "custom", message: "笔记路径不能重复" });
    paths.add(note.relativePath);
  }
  for (const link of payload.links) {
    if (!paths.has(link.sourceRelativePath)) context.addIssue({ code: "custom", message: "链接来源必须属于当前笔记快照" });
  }
});
