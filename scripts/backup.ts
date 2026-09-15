import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { getDatabase } from "../src/lib/db";

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
  const backupRoot = path.resolve(process.env.BACKUP_DIR ?? path.join(process.cwd(), "data", "backups"));
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads"));
  const destination = path.join(backupRoot, timestamp());
  const databaseSnapshot = path.join(destination, "workstation.db");

  await mkdir(destination, { recursive: true });
  const database = await getDatabase();
  const escapedSnapshot = databaseSnapshot.replaceAll("'", "''");
  await database.$executeRawUnsafe(`VACUUM INTO '${escapedSnapshot}'`);
  await database.$disconnect();

  await cp(uploadRoot, path.join(destination, "uploads"), {
    recursive: true,
    force: false,
    errorOnExist: true,
  }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });

  await writeFile(
    path.join(destination, "manifest.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), formatVersion: 1 }, null, 2),
    "utf8",
  );
  console.log(destination);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
