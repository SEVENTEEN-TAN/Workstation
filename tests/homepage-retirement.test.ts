import { access, readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { bootstrapSiteContent } from "../src/lib/content/bootstrap";

const guardedRoots = ["src", "tests", "scripts", "prisma"];
const guardedFiles = ["README.md", "docs/deployment.md"];

async function collectFiles(targets: string[]): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];

  for (const target of targets) {
    const targetStat = await stat(target);
    if (targetStat.isFile()) {
      files.push({ path: target, content: await readFile(target, "utf8") });
      continue;
    }

    for (const entry of await readdir(target, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const entryPath = join(target, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectFiles([entryPath])));
        continue;
      }
      if (entry.isFile()) {
        files.push({ path: entryPath, content: await readFile(entryPath, "utf8") });
      }
    }
  }

  return files;
}

function collectImagePaths(value: unknown, paths: string[] = []): string[] {
  if (typeof value === "string" && value.startsWith("/images/")) {
    paths.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectImagePaths(item, paths);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectImagePaths(item, paths);
  }

  return paths;
}

describe("homepage retirement readiness", () => {
  it("has no executable dependency on the sibling HomePage project", async () => {
    const files = await collectFiles([...guardedRoots, ...guardedFiles]);
    expect(files.map((file) => file.path.replaceAll(sep, "/"))).toContain("docs/deployment.md");

    const forbidden = [
      "HomePage/src",
      ".." + "/HomePage",
      ".." + "\\HomePage",
      "sqtan" + "\\HomePage",
      "migrateLegacy" + "SiteContent",
      "src/data/" + "content.js",
      "src/data/" + "projects.js",
    ];
    const currentTestPath = relative(process.cwd(), import.meta.filename).replaceAll(sep, "/");
    const matches = files.flatMap(({ path, content }) =>
      path === currentTestPath || path.replaceAll(sep, "/") === currentTestPath
        ? []
        : forbidden
            .filter((token) => content.includes(token))
            .map((token) => `${path.replaceAll(sep, "/")}: ${token}`),
    );

    expect(matches).toEqual([]);
  });

  it("ships every local image referenced by bootstrap content", async () => {
    const paths = collectImagePaths(bootstrapSiteContent);
    expect(paths.length).toBeGreaterThan(0);

    for (const imagePath of paths) {
      await expect(access(join(process.cwd(), "public", imagePath.replace(/^\//, "")))).resolves.toBeUndefined();
    }
  });
});
