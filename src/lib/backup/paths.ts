import { access } from "node:fs/promises";
import path from "node:path";

export function resolveDatabaseFile(databaseUrl: string, projectRoot = process.cwd()) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("备份工具仅支持 SQLite file: 数据库地址");
  }

  const value = decodeURIComponent(databaseUrl.slice("file:".length));
  const usesWindowsPaths = /^[A-Za-z]:[\\/]/.test(projectRoot);
  const pathApi = usesWindowsPaths ? path.win32 : path.posix;

  if (pathApi.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) {
    return pathApi.normalize(value);
  }

  return pathApi.resolve(projectRoot, "prisma", value);
}

export function resolveArticleAttachmentRoot(projectRoot = process.cwd(), configuredRoot = process.env.ARTICLE_ATTACHMENT_DIR) {
  return path.resolve(/* turbopackIgnore: true */ configuredRoot ?? path.join(projectRoot, "data", "article-attachments"));
}

export async function validateRestoreSource(sourceDirectory: string) {
  const directory = path.resolve(sourceDirectory);
  const manifestPath = path.join(directory, "manifest.json");
  const databasePath = path.join(directory, "workstation.db");

  try {
    await Promise.all([access(manifestPath), access(databasePath)]);
  } catch {
    throw new Error("备份目录不完整：缺少 manifest.json 或 workstation.db");
  }

  return { directory, manifestPath, databasePath };
}
