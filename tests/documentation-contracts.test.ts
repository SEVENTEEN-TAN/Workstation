import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = join(import.meta.dirname, "..");

describe("documentation contracts", () => {
  it("marks implementation plans as historical and the roadmap as authoritative", () => {
    const guide = readFileSync(
      join(projectRoot, "docs/superpowers/plans/README.md"),
      "utf8",
    );

    expect(guide).toContain("历史执行记录");
    expect(guide).toContain("docs/product-roadmap.md");
    expect(guide).toContain("不代表当前完成状态");
    expect(guide).toContain("不要回填或修改这些旧计划");
  });
});
