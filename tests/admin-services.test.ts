import { describe, expect, it } from "vitest";

import { siteContentSchema } from "../src/lib/content/schema";
import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import { createSiteContentService } from "../src/lib/services/site-content";
import { createOkrService } from "../src/lib/services/okr";
import { createPublicDataService } from "../src/lib/services/public-data";
import { requireAdminSession } from "../src/lib/services/auth-guard";
import {
  createAssetLibraryService,
  findAssetReferences,
  normalizeAssetAltText,
  validateImageUpload,
} from "../src/lib/services/assets";
import { parsePortfolioProjectRecord } from "../src/lib/services/portfolio-projects";
import { portfolioProjectInputSchema } from "../src/lib/validators/portfolio-projects";

const structuredProject = parsePortfolioProjectRecord({
  id: "project-1",
  createdAt: "2026-09-16T00:00:00.000Z",
  updatedAt: "2026-09-16T00:00:00.000Z",
  ...portfolioProjectInputSchema.parse({
    slug: "personal-workstation",
    titleZh: "个人工作站",
    titleEn: "Personal Workstation",
    summaryZh: "持续维护的在线职业档案。",
    summaryEn: "A continuously maintained online career profile.",
    contextZh: "需要统一展示职业证据。",
    contextEn: "Career evidence needed one coherent home.",
    responsibilityZh: "负责产品、架构与实现。",
    responsibilityEn: "Owned product, architecture and implementation.",
    challengeZh: "兼顾公开展示与私密管理。",
    challengeEn: "Balance public presentation with private administration.",
    approachZh: "使用 Next.js 与结构化内容模型。",
    approachEn: "Used Next.js with structured content models.",
    resultZh: "形成可持续更新的个人工作站。",
    resultEn: "Delivered a sustainable personal workstation.",
    coverImage: "/images/projects/workstation.webp",
    coverAltZh: "个人工作站项目界面",
    coverAltEn: "Personal Workstation project interface",
    technologies: ["Next.js"],
    links: [],
    visibility: "PUBLIC",
    featured: true,
    sortOrder: 1,
    startedAt: null,
    completedAt: null,
  }),
});

describe("site publishing", () => {
  it("archives the former release and publishes one complete validated snapshot in one transaction", async () => {
    const versions = [
      { id: "old", version: 1, status: "PUBLISHED", content: bootstrapSiteContent, publishedAt: new Date() },
      { id: "draft", version: 2, status: "DRAFT", content: bootstrapSiteContent, publishedAt: null },
    ];
    let transactions = 0;
    const service = createSiteContentService({
      async transaction(run) {
        transactions += 1;
        return run({
          async findVersion(id) { return versions.find((item) => item.id === id) ?? null; },
          async findDraft() { return versions.find((item) => item.status === "DRAFT") ?? null; },
          async updateDraft() { throw new Error("not used"); },
          async archivePublished() { versions.filter((item) => item.status === "PUBLISHED").forEach((item) => { item.status = "ARCHIVED"; }); },
          async publishVersion(id, publishedAt) { const item = versions.find((entry) => entry.id === id)!; item.status = "PUBLISHED"; item.publishedAt = publishedAt; return item; },
          async latestVersionNumber() { return Math.max(...versions.map((item) => item.version)); },
          async createVersion() { throw new Error("not used"); },
        });
      },
      async listVersions() { return versions; },
      async findPublished() { return versions.find((item) => item.status === "PUBLISHED") ?? null; },
      async findDraft() { return versions.find((item) => item.status === "DRAFT") ?? null; },
      async updateDraft() { throw new Error("not used"); },
      async findProjectsByIds() { throw new Error("not used"); },
    });

    await service.publish("draft");

    expect(transactions).toBe(1);
    expect(versions.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "old", status: "ARCHIVED" },
      { id: "draft", status: "PUBLISHED" },
    ]);
    expect(siteContentSchema.safeParse(versions[1].content).success).toBe(true);
  });
});

describe("site rollback", () => {
  it("overwrites the existing draft without changing the published version", async () => {
    const sourceContent = structuredClone(bootstrapSiteContent);
    sourceContent.en.hero.lineOne = "RESTORED SOURCE";
    const versions = [
      { id: "published", version: 3, status: "PUBLISHED", content: bootstrapSiteContent, publishedAt: new Date("2026-09-01") },
      { id: "source", version: 1, status: "ARCHIVED", content: sourceContent, publishedAt: new Date("2026-08-01") },
      { id: "draft", version: 4, status: "DRAFT", content: bootstrapSiteContent, publishedAt: null },
    ];
    const service = createSiteContentService({
      async transaction(run) {
        return run({
          async findVersion(id) { return versions.find((item) => item.id === id) ?? null; },
          async findDraft() { return versions.find((item) => item.status === "DRAFT") ?? null; },
          async updateDraft(id, content) { const item = versions.find((entry) => entry.id === id)!; item.content = content; return item; },
          async archivePublished() { throw new Error("rollback must not archive published versions"); },
          async publishVersion() { throw new Error("rollback must not publish versions"); },
          async latestVersionNumber() { return Math.max(...versions.map((item) => item.version)); },
          async createVersion() { throw new Error("not used"); },
        });
      },
      async listVersions() { return versions; },
      async findPublished() { return versions.find((item) => item.status === "PUBLISHED") ?? null; },
      async findDraft() { return versions.find((item) => item.status === "DRAFT") ?? null; },
      async updateDraft() { throw new Error("not used"); },
      async findProjectsByIds() { throw new Error("not used"); },
    });

    const restored = await service.rollback("source", "author-1");

    expect(restored).toMatchObject({ id: "draft", version: 4, status: "DRAFT", publishedAt: null, content: sourceContent });
    expect(versions[0]).toMatchObject({ id: "published", version: 3, status: "PUBLISHED" });
  });

  it("creates the next draft with no publication date and retains the author when no draft exists", async () => {
    const sourceContent = structuredClone(bootstrapSiteContent);
    sourceContent.zh.hero.lineOne = "恢复的历史内容";
    const publishedAt = new Date("2026-09-01");
    const versions = [
      { id: "published", version: 4, status: "PUBLISHED", content: bootstrapSiteContent, publishedAt },
      { id: "source", version: 2, status: "ARCHIVED", content: sourceContent, publishedAt: new Date("2026-08-01") },
    ];
    let createdInput: unknown;
    const service = createSiteContentService({
      async transaction(run) {
        return run({
          async findVersion(id) { return versions.find((item) => item.id === id) ?? null; },
          async findDraft() { return null; },
          async updateDraft() { throw new Error("not used"); },
          async archivePublished() { throw new Error("rollback must not archive published versions"); },
          async publishVersion() { throw new Error("rollback must not publish versions"); },
          async latestVersionNumber() { return Math.max(...versions.map((item) => item.version)); },
          async createVersion(input) {
            createdInput = input;
            return { id: "new-draft", ...input, publishedAt: input.publishedAt ?? null };
          },
        });
      },
      async listVersions() { return versions; },
      async findPublished() { return versions.find((item) => item.status === "PUBLISHED") ?? null; },
      async findDraft() { return null; },
      async updateDraft() { throw new Error("not used"); },
      async findProjectsByIds() { throw new Error("not used"); },
    });

    const restored = await service.rollback("source", "author-2");

    expect(restored).toMatchObject({ id: "new-draft", version: 5, status: "DRAFT", publishedAt: null, content: sourceContent });
    expect(createdInput).toMatchObject({ version: 5, status: "DRAFT", publishedAt: null, createdById: "author-2", content: sourceContent });
    expect(versions[0]).toMatchObject({ id: "published", version: 4, status: "PUBLISHED", publishedAt });
  });
});

describe("homepage project source snapshots", () => {
  it("materializes selected projects when saving a draft but preserves legacy snapshots", async () => {
    const selectedDraft = {
      id: "selected-draft",
      version: 2,
      status: "DRAFT",
      content: { ...structuredClone(bootstrapSiteContent), selectedProjectIds: ["project-1"] },
      publishedAt: null,
    };
    const legacyDraft = {
      id: "legacy-draft",
      version: 3,
      status: "DRAFT",
      content: structuredClone(bootstrapSiteContent),
      publishedAt: null,
    };
    const versions = [selectedDraft, legacyDraft];
    const loadedIds: string[][] = [];
    const savedContent: unknown[] = [];
    const service = createSiteContentService({
      transaction: async () => { throw new Error("not used"); },
      async listVersions() { return versions; },
      async findPublished() { return null; },
      async findDraft() { return selectedDraft; },
      async updateDraft(_id, content) { savedContent.push(content); return { ...selectedDraft, content }; },
      async findProjectsByIds(ids) {
        loadedIds.push(ids);
        return ids.map(() => structuredProject);
      },
    } as never);

    await service.saveDraft("selected-draft", selectedDraft.content);
    await service.saveDraft("legacy-draft", legacyDraft.content);

    expect(loadedIds).toEqual([["project-1"]]);
    expect(savedContent[0]).toMatchObject({
      selectedProjectIds: ["project-1"],
      en: { projects: [{ slug: "personal-workstation", title: "Personal Workstation" }] },
      zh: { projects: [{ slug: "personal-workstation", title: "个人工作站" }] },
    });
    expect(savedContent[1]).toEqual(bootstrapSiteContent);
  });

  it("publishes the saved snapshot without re-reading structured projects", async () => {
    const materializedContent = structuredClone(bootstrapSiteContent);
    materializedContent.selectedProjectIds = ["project-1"];
    materializedContent.en.projects = [{ slug: "personal-workstation", image: "", category: "Next.js", title: "Personal Workstation", description: "A continuously maintained online career profile.", tags: ["Next.js"], alt: "Personal Workstation" }];
    materializedContent.zh.projects = [{ slug: "personal-workstation", image: "", category: "Next.js", title: "个人工作站", description: "持续维护的在线职业档案。", tags: ["Next.js"], alt: "个人工作站" }];
    const versions = [
      { id: "draft", version: 2, status: "DRAFT", content: materializedContent, publishedAt: null },
    ];
    let projectLoads = 0;
    const service = createSiteContentService({
      async transaction(run) {
        return run({
          async findVersion(id) { return versions.find((item) => item.id === id) ?? null; },
          async findDraft() { return versions[0]; },
          async updateDraft() { throw new Error("not used"); },
          async archivePublished() {},
          async publishVersion(id) { const item = versions.find((entry) => entry.id === id)!; item.status = "PUBLISHED"; item.publishedAt = new Date(); return item; },
          async latestVersionNumber() { return versions[0].version; },
          async createVersion() { throw new Error("not used"); },
        });
      },
      async listVersions() { return versions; },
      async findPublished() { return versions[0]; },
      async findDraft() { return versions[0]; },
      async updateDraft() { throw new Error("not used"); },
      async findProjectsByIds() { projectLoads += 1; return [structuredProject]; },
    } as never);

    await service.publish("draft");

    expect(projectLoads).toBe(0);
    expect(versions[0].content).toEqual(materializedContent);
  });
});

describe("public data service", () => {
  it("returns only published content and public children of public cycles", async () => {
    const service = createPublicDataService({
      async findPublishedSiteVersion() { return { content: bootstrapSiteContent }; },
      async findOkrCycles() {
        return [
          { id: "private-cycle", visibility: "PRIVATE", objectives: [{ id: "leak", visibility: "PUBLIC", keyResults: [] }], reviews: [] },
          { id: "public-cycle", visibility: "PUBLIC", nameEn: "2026 Q3", objectives: [
            { id: "public-objective", visibility: "PUBLIC", titleEn: "Public objective", sortOrder: 1, keyResults: [] },
            { id: "private-objective", visibility: "PRIVATE", sortOrder: 2, keyResults: [] },
          ], reviews: [{ id: "public-review", visibility: "PUBLIC", achievementsEn: "Delivered", problemsEn: "Scope risk", lessonsEn: "Review weekly", nextActionsEn: "Ship next iteration" }, { id: "private-review", visibility: "PRIVATE" }] },
        ];
      },
    });

    const result = await service.getPublicOkrData();

    expect(result.map((cycle) => cycle.id)).toEqual(["public-cycle"]);
    expect(result[0].objectives.map((objective) => objective.id)).toEqual(["public-objective"]);
    expect(result[0].reviews.map((review) => review.id)).toEqual(["public-review"]);
    await expect(service.getPublishedSiteContent()).resolves.toEqual(bootstrapSiteContent);
  });

  it("returns only public OKR records with complete bilingual evidence", async () => {
    const service = createPublicDataService({
      async findOkrCycles() {
        return [
          {
            id: "cycle-without-english-name", visibility: "PUBLIC", nameZh: "2026 第三季度", nameEn: null,
            status: "ACTIVE", startDate: new Date("2026-07-01"), endDate: new Date("2026-09-30"),
            objectives: [], reviews: [],
          },
          {
            id: "public-cycle", visibility: "PUBLIC", nameZh: "2026 第四季度", nameEn: "2026 Q4",
            status: "ACTIVE", startDate: new Date("2026-10-01"), endDate: new Date("2026-12-31"),
            objectives: [
              {
                id: "objective-without-english-title", visibility: "PUBLIC", sortOrder: 1,
                titleZh: "缺失英文标题", titleEn: null, status: "IN_PROGRESS", keyResults: [],
              },
              {
                id: "objective-with-unpaired-description", visibility: "PUBLIC", sortOrder: 2,
                titleZh: "说明未成对", titleEn: "Unpaired description", descriptionZh: "中文说明",
                status: "IN_PROGRESS", keyResults: [],
              },
              {
                id: "objective-with-incomplete-kr", visibility: "PUBLIC", sortOrder: 3,
                titleZh: "KR 未翻译", titleEn: "Incomplete key result", status: "IN_PROGRESS",
                keyResults: [{ id: "kr-without-english-title", titleZh: "未翻译 KR", titleEn: null }],
              },
              {
                id: "public-objective", visibility: "PUBLIC", sortOrder: 4,
                titleZh: "公开目标", titleEn: "Public objective", status: "IN_PROGRESS",
                keyResults: [{ id: "public-kr", titleZh: "公开 KR", titleEn: "Public key result" }],
              },
            ],
            reviews: [
              {
                id: "review-without-english-lessons", visibility: "PUBLIC",
                achievementsZh: "成果", achievementsEn: "Achievements",
                problemsZh: "问题", problemsEn: "Problems",
                lessonsZh: "经验", lessonsEn: null,
                nextActionsZh: "行动", nextActionsEn: "Next actions",
                score: 8, reviewedAt: new Date("2026-12-31"),
              },
              {
                id: "public-review", visibility: "PUBLIC",
                achievementsZh: "成果", achievementsEn: "Achievements",
                problemsZh: "问题", problemsEn: "Problems",
                lessonsZh: "经验", lessonsEn: "Lessons",
                nextActionsZh: "行动", nextActionsEn: "Next actions",
                score: 9, reviewedAt: new Date("2026-12-31"),
              },
            ],
          },
        ];
      },
    });

    const result = await service.getPublicOkrData();

    expect(result.map((cycle) => cycle.id)).toEqual(["public-cycle"]);
    expect(result[0].objectives.map((objective) => objective.id)).toEqual(["public-objective"]);
    expect(result[0].reviews.map((review) => review.id)).toEqual(["public-review"]);
  });

  it("reports an uninitialized site instead of manufacturing content", async () => {
    const service = createSiteContentService({
      transaction: async () => { throw new Error("not used"); },
      listVersions: async () => [],
      findPublished: async () => null,
      findDraft: async () => null,
      updateDraft: async () => { throw new Error("not used"); },
      findProjectsByIds: async () => { throw new Error("not used"); },
    });

    await expect(service.getPublished()).resolves.toBeNull();
    await expect(service.getOrCreateDraft()).rejects.toThrow("站点尚未初始化，请先运行数据库种子");
  });
});

describe("KR progress updates", () => {
  it("updates the KR and appends the calculated progress history atomically", async () => {
    const history: Array<{ keyResultId: string; calculatedProgress: number }> = [];
    const milestones: Array<{ sourceKey: string }> = [];
    const keyResult = {
      id: "kr-1", progressMode: "METRIC", startValue: 0, currentValue: 2, targetValue: 10, manualProgress: null,
      titleZh: "完成工作站自动化", titleEn: "Ship workstation automation",
      objective: { titleZh: "完成工作站 V3", titleEn: "Ship Workstation V3", cycle: { nameZh: "2026 Q3", nameEn: "2026 Q3" } },
    };
    const service = createOkrService({
      async transaction(run) {
        return run({
          async findKeyResult(id) { return id === keyResult.id ? keyResult : null; },
          async updateKeyResultProgress(_id, values) { Object.assign(keyResult, values); return keyResult; },
          async createProgressUpdate(values) { history.push(values); return values; },
          async createMilestoneDraft(values) { milestones.push(values); return values; },
        });
      },
    } as never);

    const updated = await service.recordProgress("kr-1", { currentValue: 7, noteZh: "完成接口" });

    expect(updated.progress).toBe(70);
    expect(keyResult.currentValue).toBe(7);
    expect(history).toEqual([expect.objectContaining({ keyResultId: "kr-1", currentValue: 7, manualProgress: null, calculatedProgress: 70, noteZh: "完成接口", noteEn: null })]);
    expect(milestones).toEqual([expect.objectContaining({ sourceKey: "KR_PROGRESS:kr-1:50" })]);
  });
});

describe("OKR completion milestones", () => {
  it("creates one stable draft when an Objective first becomes completed", async () => {
    const milestones: Array<{ sourceKey: string }> = [];
    const objective = {
      id: "objective-1", cycleId: "cycle-1", status: "IN_PROGRESS",
      titleZh: "完成工作站 V3", titleEn: "Ship Workstation V3",
      cycle: { nameZh: "2026 Q3", nameEn: "2026 Q3" },
    };
    const service = createOkrService({
      async entityTransaction(run) {
        return run({
          async findObjectiveForUpdate() { return objective; },
          async updateObjectiveRecord(_id, values) { Object.assign(objective, values); return objective; },
          async findKeyResultForUpdate() { return null; },
          async updateKeyResultRecord() { throw new Error("not used"); },
          async createMilestoneDraft(values) { milestones.push(values); return values; },
        });
      },
    } as never);

    await service.updateObjective("objective-1", { status: "COMPLETED" });

    expect(milestones).toEqual([expect.objectContaining({ sourceKey: "OBJECTIVE_COMPLETED:objective-1" })]);
  });

  it("does not duplicate a completion draft when the entity was already completed", async () => {
    const milestones: unknown[] = [];
    const keyResult = {
      id: "kr-1", objectiveId: "objective-1", status: "COMPLETED",
      titleZh: "完成自动化", titleEn: "Finish automation",
      objective: { titleZh: "完成工作站 V3", titleEn: "Ship Workstation V3", cycle: { nameZh: "2026 Q3", nameEn: "2026 Q3" } },
    };
    const service = createOkrService({
      async entityTransaction(run) {
        return run({
          async findObjectiveForUpdate() { return null; },
          async updateObjectiveRecord() { throw new Error("not used"); },
          async findKeyResultForUpdate() { return keyResult; },
          async updateKeyResultRecord(_id, values) { Object.assign(keyResult, values); return keyResult; },
          async createMilestoneDraft(values) { milestones.push(values); return values; },
        });
      },
    } as never);

    await service.updateKeyResult("kr-1", { status: "COMPLETED" });

    expect(milestones).toEqual([]);
  });
});

describe("focused OKR queries", () => {
  it("returns cycle summaries through the focused list query", async () => {
    const cycles = [{ id: "cycle-1", objectives: [], reviews: [] }];
    const service = createOkrService({
      async listCycles() { return cycles; },
    });

    await expect(service.listCycles()).resolves.toBe(cycles);
  });

  it("returns null for a missing cycle", async () => {
    const service = createOkrService({
      async findCycle() { return null; },
    });

    await expect(service.getCycle("missing")).resolves.toBeNull();
  });

  it("rejects an Objective that does not belong to the requested cycle", async () => {
    const service = createOkrService({
      async findObjective() {
        return { id: "objective-1", cycleId: "cycle-a", cycle: { id: "cycle-a" }, keyResults: [], reviews: [] };
      },
    });

    await expect(service.getObjective("objective-1", "cycle-b")).resolves.toBeNull();
    await expect(service.getObjective("objective-1", "cycle-a")).resolves.toMatchObject({ id: "objective-1" });
  });
});

describe("admin protection", () => {
  it("rejects a request when there is no active session", async () => {
    await expect(requireAdminSession(async () => null)).rejects.toMatchObject({ status: 401 });
  });
});

describe("asset validation", () => {
  it("accepts a valid PNG and rejects spoofed or oversized images", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    expect(validateImageUpload({ bytes: png, mimeType: "image/png", filename: "portrait.png", maxBytes: 20 }).extension).toBe("png");
    expect(() => validateImageUpload({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/png", filename: "fake.png", maxBytes: 20 })).toThrow("文件内容与图片类型不匹配");
    expect(() => validateImageUpload({ bytes: png, mimeType: "image/png", filename: "portrait.png", maxBytes: 4 })).toThrow("图片大小超过限制");
  });

  it("normalizes bilingual alternative text and rejects excessive values", () => {
    expect(normalizeAssetAltText({ altTextZh: "  项目界面  ", altTextEn: "   " })).toEqual({
      altTextZh: "项目界面",
      altTextEn: null,
    });
    expect(() => normalizeAssetAltText({ altTextZh: "图".repeat(501), altTextEn: "" }))
      .toThrow("替代文本不能超过 500 个字符");
  });
});

describe("asset reference safety", () => {
  const referencedContent = structuredClone(bootstrapSiteContent);
  referencedContent.zh.projects[0].image = "/api/assets/asset-1";
  referencedContent.en.projects[1].image = "/api/assets/asset-1";

  it("reports every homepage version and field that references an asset", () => {
    expect(findAssetReferences("asset-1", [
      { id: "draft", version: 4, status: "DRAFT", content: referencedContent },
    ])).toEqual([
      { source: "SITE_VERSION", versionId: "draft", version: 4, status: "DRAFT", path: "zh.projects.0.image", label: "版本 4 · 草稿" },
      { source: "SITE_VERSION", versionId: "draft", version: 4, status: "DRAFT", path: "en.projects.1.image", label: "版本 4 · 草稿" },
    ]);
  });

  it("blocks deletion when any content version still references the asset", async () => {
    let deleted = false;
    const service = createAssetLibraryService({
      async listAssets() { return []; },
      async listSiteVersions() { return [{ id: "published", version: 3, status: "PUBLISHED", content: referencedContent }]; },
      async listKnowledgeDraftAttachments() { return []; },
      async findAsset() { return { id: "asset-1", storagePath: "C:/uploads/image.png" }; },
      async updateAsset() { throw new Error("not used"); },
      async deleteAsset() { deleted = true; },
    }, async () => {});

    const error = await service.delete("asset-1").catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Response);
    expect(error).toMatchObject({ status: 409 });
    expect(deleted).toBe(false);
  });

  it("reports knowledge publication drafts that reference an asset", async () => {
    const service = createAssetLibraryService({
      async listAssets() { return [{ id: "asset-1" }]; },
      async listSiteVersions() { return []; },
      async listKnowledgeDraftAttachments() {
        return [{ draftId: "draft-1", draftTitle: "Workstation notes", target: "diagram.png", assetId: "asset-1" }];
      },
      async findAsset() { return { id: "asset-1", storagePath: "C:/uploads/image.png" }; },
      async updateAsset() { throw new Error("not used"); },
      async deleteAsset() { throw new Error("not used"); },
    } as Parameters<typeof createAssetLibraryService>[0], async () => {});

    await expect(service.list()).resolves.toMatchObject([
      {
        id: "asset-1",
        isReferenced: true,
        references: [
          {
            source: "KNOWLEDGE_DRAFT",
            versionId: "draft-1",
            version: null,
            status: "DRAFT",
            path: "knowledge.attachments.diagram.png",
            label: "知识发布草稿 · Workstation notes",
          },
        ],
      },
    ]);
  });

  it("deletes an unreferenced asset record and its stored file", async () => {
    let deletedId = "";
    let removedPath = "";
    const service = createAssetLibraryService({
      async listAssets() { return []; },
      async listSiteVersions() { return []; },
      async listKnowledgeDraftAttachments() { return []; },
      async findAsset(id) { return { id, storagePath: "C:/uploads/image.png" }; },
      async updateAsset() { throw new Error("not used"); },
      async deleteAsset(id) { deletedId = id; },
    }, async (path) => { removedPath = path; });

    await expect(service.delete("asset-1")).resolves.toEqual({ id: "asset-1" });
    expect(deletedId).toBe("asset-1");
    expect(removedPath).toBe("C:/uploads/image.png");
  });

  it("replaces the stored file while preserving the asset identity and alternative text", async () => {
    const events: string[] = [];
    const asset = {
      id: "asset-1",
      originalFilename: "old.png",
      storagePath: "C:/uploads/old.png",
      mimeType: "image/png",
      width: 120,
      height: 80,
      sizeBytes: 9,
      sha256: "old-hash",
      altTextZh: "项目界面",
      altTextEn: "Project screen",
    };
    const service = createAssetLibraryService({
      async listAssets() { return [asset]; },
      async listSiteVersions() { return []; },
      async listKnowledgeDraftAttachments() { return []; },
      async findAsset() { return asset; },
      async updateAsset(id, data) {
        events.push(`update:${id}`);
        Object.assign(asset, data);
        return asset;
      },
      async deleteAsset() { throw new Error("not used"); },
    }, async (path) => { events.push(`remove:${path}`); }, async () => {
      events.push("write:new");
      return {
        originalFilename: "new.webp",
        storagePath: "C:/uploads/new.webp",
        mimeType: "image/webp",
        width: null,
        height: null,
        sizeBytes: 12,
        sha256: "new-hash",
      };
    });

    const replaced = await service.replace("asset-1", new File(["replacement"], "new.webp", { type: "image/webp" }));

    expect(events).toEqual(["write:new", "update:asset-1", "remove:C:/uploads/old.png"]);
    expect(replaced).toMatchObject({
      id: "asset-1",
      originalFilename: "new.webp",
      storagePath: "C:/uploads/new.webp",
      sha256: "new-hash",
      altTextZh: "项目界面",
      altTextEn: "Project screen",
    });
  });

  it("removes the newly written file when replacement metadata cannot be saved", async () => {
    const removed: string[] = [];
    const service = createAssetLibraryService({
      async listAssets() { return []; },
      async listSiteVersions() { return []; },
      async listKnowledgeDraftAttachments() { return []; },
      async findAsset() { return { id: "asset-1", storagePath: "C:/uploads/old.png" }; },
      async updateAsset() { throw new Error("database unavailable"); },
      async deleteAsset() { throw new Error("not used"); },
    }, async (path) => { removed.push(path); }, async () => ({
      originalFilename: "new.png",
      storagePath: "C:/uploads/new.png",
      mimeType: "image/png",
      width: null,
      height: null,
      sizeBytes: 9,
      sha256: "new-hash",
    }));

    await expect(service.replace("asset-1", new File(["replacement"], "new.png", { type: "image/png" })))
      .rejects.toThrow("database unavailable");
    expect(removed).toEqual(["C:/uploads/new.png"]);
  });

  it("preserves the database error when replacement cleanup also fails", async () => {
    const service = createAssetLibraryService({
      async listAssets() { return []; },
      async listSiteVersions() { return []; },
      async listKnowledgeDraftAttachments() { return []; },
      async findAsset() { return { id: "asset-1", storagePath: "C:/uploads/old.png" }; },
      async updateAsset() { throw new Error("database unavailable"); },
      async deleteAsset() { throw new Error("not used"); },
    }, async () => { throw new Error("cleanup unavailable"); }, async () => ({
      originalFilename: "new.png",
      storagePath: "C:/uploads/new.png",
      mimeType: "image/png",
      width: null,
      height: null,
      sizeBytes: 9,
      sha256: "new-hash",
    }));

    await expect(service.replace("asset-1", new File(["replacement"], "new.png", { type: "image/png" })))
      .rejects.toThrow("database unavailable");
  });

  it("returns 404 before writing a replacement for a missing asset", async () => {
    let wroteFile = false;
    const service = createAssetLibraryService({
      async listAssets() { return []; },
      async listSiteVersions() { return []; },
      async listKnowledgeDraftAttachments() { return []; },
      async findAsset() { return null; },
      async updateAsset() { throw new Error("not used"); },
      async deleteAsset() { throw new Error("not used"); },
    }, async () => {}, async () => {
      wroteFile = true;
      throw new Error("must not write");
    });

    const error = await service.replace("missing", new File(["replacement"], "new.png", { type: "image/png" }))
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Response);
    expect(error).toMatchObject({ status: 404 });
    expect(wroteFile).toBe(false);
  });
});
