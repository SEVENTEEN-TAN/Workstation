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
    const aiContentDraftSource = readFileSync(
      join(projectRoot, "src/lib/services/ai-content-drafts.ts"),
      "utf8",
    );
    const aiGenerationSource = readFileSync(
      join(projectRoot, "src/lib/services/ai-generation.ts"),
      "utf8",
    );
    const weeklyActivityDraftSource = readFileSync(
      join(projectRoot, "src/lib/services/weekly-activity-drafts.ts"),
      "utf8",
    );
    const okrMilestoneDraftSource = readFileSync(
      join(projectRoot, "src/lib/services/okr-milestone-drafts.ts"),
      "utf8",
    );
    const careerTimelineDraftSource = readFileSync(
      join(projectRoot, "src/lib/services/career-timeline-drafts.ts"),
      "utf8",
    );
    const knowledgeVaultSource = readFileSync(
      join(projectRoot, "src/lib/services/knowledge-vaults.ts"),
      "utf8",
    );
    const okrSource = readFileSync(
      join(projectRoot, "src/lib/services/okr.ts"),
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
    expect(aiContentDraftSource).not.toContain("as Promise<Record<string, unknown> | null>");
    expect(aiContentDraftSource).not.toContain("as Promise<DraftRecord | null>");
    expect(aiGenerationSource).not.toContain("as Promise<AiGenerationSetting | null>");
    expect(weeklyActivityDraftSource).not.toContain("as Prisma.CareerActivityCreateInput");
    expect(okrMilestoneDraftSource).not.toContain("as Prisma.CareerActivityCreateInput");
    expect(careerTimelineDraftSource).not.toContain("as Prisma.CareerActivityCreateInput");
    expect(knowledgeVaultSource).not.toContain("as Prisma.KnowledgeVaultUpdateInput");
    expect(okrSource).not.toContain("as Prisma.ActionItemUncheckedUpdateInput");
    expect(aiProviderSource).not.toContain("as unknown as Prisma.AiProviderUncheckedCreateInput");
  });
});
