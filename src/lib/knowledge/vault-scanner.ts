import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, join, relative, sep } from "node:path";
import { parseDocument } from "yaml";

const DEFAULT_IGNORED_DIRECTORIES = new Set([".obsidian", ".trash", ".claudian", ".workbuddy"]);

export type ScannedKnowledgeNote = {
  relativePath: string;
  fileName: string;
  directoryPath: string;
  sizeBytes: number;
  modifiedAt: Date;
  sha256: string;
  hasFrontmatter: boolean;
  hasWikilinks: boolean;
  hasEmbeds: boolean;
  hasCallouts: boolean;
  hasDataview: boolean;
  hasTasks: boolean;
  isMoc: boolean;
  frontmatter: Record<string, unknown> | null;
};

export type VaultScanResult = {
  scannedAt: Date;
  notes: ScannedKnowledgeNote[];
};

function normalizeSegments(value: string) {
  return value.split(/[\\/]+/).filter(Boolean);
}

function globSegmentsMatch(segments: string[], patternSegments: string[]) {
  if (segments.length !== patternSegments.length) return false;
  return segments.every((segment, index) => {
    const pattern = patternSegments[index];
    if (!pattern.includes("*")) return segment === pattern;
    const expression = new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
    return expression.test(segment);
  });
}

function isIgnored(relativePath: string, configuredPatterns: string[]) {
  const segments = normalizeSegments(relativePath);
  if (segments.some((segment) => DEFAULT_IGNORED_DIRECTORIES.has(segment))) return true;

  return configuredPatterns.some((pattern) => {
    const patternSegments = normalizeSegments(pattern);
    if (!patternSegments.length) return false;
    if (patternSegments.length === 1 && !pattern.includes("*")) {
      return segments.some((segment) => segment === patternSegments[0]);
    }
    if (!pattern.includes("*")) {
      return patternSegments.every((segment, index) => segments[index] === segment);
    }
    if (patternSegments.length === 1) return globSegmentsMatch([segments.at(-1) ?? ""], patternSegments);
    return globSegmentsMatch(segments, patternSegments);
  });
}

function detectSyntax(content: string) {
  return {
    hasFrontmatter: /^---\r?\n/.test(content),
    hasWikilinks: /\[\[[^\]]+\]\]/.test(content),
    hasEmbeds: /!\[\[[^\]]+\]\]/.test(content),
    hasCallouts: /> \[![a-z]+\]/i.test(content),
    hasDataview: /```(?:dataview|dataviewjs)\b/i.test(content),
    hasTasks: /^[ \t]*(?:[-*+]|\d+\.) \[[ xX]\]/m.test(content),
  };
}

function parseFrontmatter(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;

  const document = parseDocument(match[1]);
  if (document.errors.length) return null;
  const value = document.toJSON();
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isMocNote(fileName: string, frontmatter: Record<string, unknown> | null) {
  const name = basename(fileName, extname(fileName)).toLocaleLowerCase();
  if (["moc", "index", "索引"].includes(name)) return true;
  if (!frontmatter) return false;

  const type = frontmatter.type ?? frontmatter.layout;
  if (typeof type === "string" && ["moc", "index"].includes(type.toLocaleLowerCase())) return true;

  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  return tags.some((tag) => typeof tag === "string" && ["moc", "index"].includes(tag.replace(/^#/, "").toLocaleLowerCase()));
}

export async function scanVault(rootPath: string, ignorePatterns: readonly string[] = []): Promise<VaultScanResult> {
  let rootStat;
  try {
    rootStat = await stat(rootPath);
  } catch {
    throw new Error("Vault root path does not exist or is not a directory");
  }
  if (!rootStat.isDirectory()) throw new Error("Vault root path does not exist or is not a directory");

  const configuredPatterns = [...new Set(ignorePatterns.map((pattern) => pattern.trim()).filter(Boolean))];
  const notes: ScannedKnowledgeNote[] = [];

  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        const relativePath = relative(rootPath, absolutePath).split(sep).join("/");
        if (!isIgnored(relativePath, configuredPatterns)) await walk(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (extname(entry.name).toLowerCase() !== ".md") continue;

      const relativePath = relative(rootPath, absolutePath).split(sep).join("/");
      if (isIgnored(relativePath, configuredPatterns)) continue;

      const [fileStat, content] = await Promise.all([stat(absolutePath), readFile(absolutePath, "utf8")]);
      const frontmatter = parseFrontmatter(content);
      notes.push({
        relativePath,
        fileName: basename(absolutePath),
        directoryPath: dirname(relativePath) === "." ? "" : dirname(relativePath),
        sizeBytes: fileStat.size,
        modifiedAt: fileStat.mtime,
        sha256: createHash("sha256").update(content).digest("hex"),
        ...detectSyntax(content),
        isMoc: isMocNote(entry.name, frontmatter),
        frontmatter,
      });
    }
  }

  await walk(rootPath);
  notes.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return { scannedAt: new Date(), notes };
}
