import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = join(import.meta.dirname, "..");

describe("service boundary types", () => {
  it("does not bypass repository return types with double casts", () => {
    const publicDataSource = readFileSync(
      join(projectRoot, "src/lib/services/public-data.ts"),
      "utf8",
    );
    const knowledgeArticleSource = readFileSync(
      join(projectRoot, "src/lib/services/knowledge-articles.ts"),
      "utf8",
    );
    const knowledgeCollectionSource = readFileSync(
      join(projectRoot, "src/lib/services/knowledge-collections.ts"),
      "utf8",
    );
    const aiProviderSource = readFileSync(
      join(projectRoot, "src/lib/services/ai-providers.ts"),
      "utf8",
    );

    expect(publicDataSource).not.toContain("as unknown as PublicCycleSourceRecord[]");
    expect(knowledgeArticleSource).not.toContain("as unknown as PublicKnowledgeArticle");
    expect(knowledgeArticleSource).not.toContain("as Promise<DraftRecord | null>");
    expect(knowledgeCollectionSource).not.toContain('visibility: value.visibility as "PRIVATE" | "PUBLIC"');
    expect(aiProviderSource).not.toContain("as unknown as Prisma.AiProviderUncheckedCreateInput");
  });
});
