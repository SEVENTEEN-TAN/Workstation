import { describe, expect, it } from "vitest";

import { resolveDatabaseFile, validateRestoreSource } from "../src/lib/backup/paths";

describe("backup paths", () => {
  it("resolves a relative Prisma SQLite URL from the prisma directory", () => {
    expect(resolveDatabaseFile("file:./workstation.db", "C:/workspace/WorkStation")).toBe(
      "C:\\workspace\\WorkStation\\prisma\\workstation.db",
    );
  });

  it("accepts an absolute SQLite URL", () => {
    expect(resolveDatabaseFile("file:/var/lib/workstation.db", "/srv/app")).toBe(
      "/var/lib/workstation.db",
    );
  });

  it("requires a manifest and database snapshot before restore", async () => {
    await expect(validateRestoreSource("C:/missing-backup")).rejects.toThrow(
      "备份目录不完整",
    );
  });
});
