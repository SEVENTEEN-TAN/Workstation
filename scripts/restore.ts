import { copyFile, cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { resolveDatabaseFile, validateRestoreSource } from "../src/lib/backup/paths";

function sourceArgument() {
  const index = process.argv.indexOf("--from");
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error("请使用 --from 指定备份目录");
  }
  return process.argv[index + 1];
}

async function main() {
  const source = await validateRestoreSource(sourceArgument());
  const manifest = JSON.parse(await readFile(source.manifestPath, "utf8")) as { formatVersion?: number };
  if (manifest.formatVersion !== 1) throw new Error("不支持的备份格式");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("缺少 DATABASE_URL");
  const databasePath = resolveDatabaseFile(databaseUrl);
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads"));

  await mkdir(path.dirname(databasePath), { recursive: true });
  await copyFile(source.databasePath, databasePath);
  await Promise.all([
    rm(`${databasePath}-wal`, { force: true }),
    rm(`${databasePath}-shm`, { force: true }),
  ]);

  const sourceUploads = path.join(source.directory, "uploads");
  await rm(uploadRoot, { recursive: true, force: true });
  await cp(sourceUploads, uploadRoot, { recursive: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  console.log(`已从 ${source.directory} 恢复。启动服务前请运行 npm run db:validate。`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
