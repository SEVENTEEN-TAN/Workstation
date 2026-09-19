import { describe, expect, it } from "vitest";

type Revision = {
  draft: { article: { slug: string } | null } | null;
};

let describeVaultRemoval: ((vault: { sourceRevisions: Revision[] }) => string) | null = null;
try {
  ({ describeVaultRemoval } = await import("../src/components/admin/knowledge-vault-removal"));
} catch {
  // The first red run establishes the missing removal guidance.
}

describe("knowledge vault removal guidance", () => {
  it("describes index-only removal when no publication depends on the vault", () => {
    expect(describeVaultRemoval).not.toBeNull();
    expect(describeVaultRemoval!({
      sourceRevisions: [{ draft: null }, { draft: null }],
    })).toBe("将移除 2 个源修订与工作站索引；本地 Vault 文件不会被删除或修改。");
  });

  it("warns before the database blocks removal when drafts or articles exist", () => {
    expect(describeVaultRemoval!({
      sourceRevisions: [
        { draft: null },
        { draft: { article: null } },
        { draft: { article: { slug: "published-entry" } } },
      ],
    })).toBe(
      "当前保留 3 个源修订、2 个发布草稿、1 篇已发布文章。发布草稿或已发布文章依赖源修订，系统会阻止移除；请先处理发布草稿或下架文章。本地 Vault 文件不会被删除或修改。",
    );
  });
});
