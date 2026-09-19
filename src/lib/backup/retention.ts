import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const BACKUP_DIRECTORY_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

export function selectExpiredBackupDirectoryNames(
  directoryNames: string[],
  now: Date,
  retentionDays: number,
): string[] {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;

  return directoryNames.filter((name) => {
    if (!BACKUP_DIRECTORY_PATTERN.test(name)) return false;

    const timestamp = Date.parse(
      `${name.slice(0, 13)}:${name.slice(14, 16)}:${name.slice(17, 19)}.${name.slice(20, 23)}Z`,
    );
    return Number.isFinite(timestamp) && timestamp < cutoff;
  });
}

export async function pruneExpiredBackups(
  backupRoot: string,
  options: { now?: Date; retentionDays?: number; exclude?: string[] },
): Promise<string[]> {
  const now = options.now ?? new Date();
  const retentionDays = options.retentionDays ?? 30;
  const excluded = new Set(options.exclude ?? []);
  const entries = await readdir(backupRoot, { withFileTypes: true });
  const expired = selectExpiredBackupDirectoryNames(
    entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    now,
    retentionDays,
  ).filter((name) => !excluded.has(name));

  for (const name of expired) {
    await rm(path.join(backupRoot, name), { recursive: true, force: true });
  }

  return expired;
}
