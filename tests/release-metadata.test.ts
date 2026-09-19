import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("release metadata", () => {
  it("keeps the automation release version aligned across package and changelog", async () => {
    const expectedVersion = "1.1.0";
    const root = process.cwd();
    const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as { version?: string };
    const packageLock = JSON.parse(await readFile(join(root, "package-lock.json"), "utf8")) as {
      version?: string;
      packages?: { "": { version?: string } };
    };
    const changelog = await readFile(join(root, "CHANGELOG.md"), "utf8");

    expect(packageJson.version).toBe(expectedVersion);
    expect(packageLock.version).toBe(expectedVersion);
    expect(packageLock.packages?.[""].version).toBe(expectedVersion);
    expect(changelog).toMatch(/^## v1\.1\.0 - \d{4}-\d{2}-\d{2}$/m);
    expect(changelog.indexOf("## v1.1.0")).toBeLessThan(changelog.indexOf("## v1.0.0"));
  });
});
