import { describe, expect, it } from "vitest";

import { createSkillCapabilityService, parseSkillAreaRecord } from "../src/lib/services/skill-capabilities";
import { skillAreaInputSchema } from "../src/lib/validators/skill-capabilities";

const completeArea = {
  nameZh: "后端工程",
  nameEn: "Backend Engineering",
  descriptionZh: "构建可靠、可维护的服务端系统。",
  descriptionEn: "Build reliable and maintainable backend systems.",
  visibility: "PUBLIC",
  sortOrder: 1,
  skills: [{
    nameZh: "Java 服务端",
    nameEn: "Java Backend",
    summaryZh: "覆盖服务设计、数据建模与交付。",
    summaryEn: "Covers service design, data modeling and delivery.",
    visibility: "PUBLIC",
    sortOrder: 0,
    evidence: [
      { kind: "PROJECT", projectId: "project-public", sortOrder: 0 },
      {
        kind: "ARTICLE",
        titleZh: "服务端设计复盘",
        titleEn: "Backend Design Review",
        url: "https://example.com/backend-review",
        sortOrder: 1,
      },
      { kind: "PROJECT", projectId: "project-private", sortOrder: 2 },
    ],
  }],
};

function record(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-09-15T00:00:00.000Z");
  const value = skillAreaInputSchema.parse({ ...completeArea, ...overrides });
  return {
    ...value,
    id: "area-1",
    createdAt: now,
    updatedAt: now,
    skills: value.skills.map((skill, skillIndex) => ({
      ...skill,
      id: `skill-${skillIndex + 1}`,
      areaId: "area-1",
      createdAt: now,
      updatedAt: now,
      evidence: skill.evidence.map((evidence, evidenceIndex) => ({
        ...evidence,
        id: `evidence-${evidenceIndex + 1}`,
        skillId: `skill-${skillIndex + 1}`,
        createdAt: now,
        updatedAt: now,
      })),
    })),
  };
}

describe("skill capability validation", () => {
  it("normalizes article URLs and defaults ordering", () => {
    const value = skillAreaInputSchema.parse({
      ...completeArea,
      sortOrder: undefined,
      skills: completeArea.skills.map((skill) => ({
        ...skill,
        sortOrder: undefined,
        evidence: skill.evidence.map((evidence) => ({ ...evidence, sortOrder: undefined })),
      })),
    });

    expect(value.sortOrder).toBe(0);
    expect(value.skills[0].sortOrder).toBe(0);
    expect(value.skills[0].evidence[1]).toMatchObject({
      kind: "ARTICLE",
      url: "https://example.com/backend-review",
      sortOrder: 0,
    });
  });

  it("requires bilingual content for public areas, skills and article evidence", () => {
    const result = skillAreaInputSchema.safeParse({
      ...completeArea,
      nameEn: "",
      skills: [{
        ...completeArea.skills[0],
        nameEn: null,
        evidence: [{
          kind: "ARTICLE",
          titleZh: "服务端设计复盘",
          titleEn: "",
          url: "https://example.com/backend-review",
        }],
      }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual([
        "nameEn",
        "skills.0.nameEn",
        "skills.0.evidence.0.titleEn",
      ]);
    }
  });

  it("requires the matching target for each evidence kind", () => {
    expect(skillAreaInputSchema.safeParse({
      ...completeArea,
      visibility: "PRIVATE",
      skills: [{ ...completeArea.skills[0], visibility: "PRIVATE", evidence: [{ kind: "PROJECT" }] }],
    }).success).toBe(false);

    expect(skillAreaInputSchema.safeParse({
      ...completeArea,
      visibility: "PRIVATE",
      skills: [{ ...completeArea.skills[0], visibility: "PRIVATE", evidence: [{ kind: "ARTICLE", titleZh: "文章", url: "" }] }],
    }).success).toBe(false);
  });

  it("allows only http and https article links", () => {
    for (const url of ["javascript:alert(1)", "mailto:hello@example.com", "file:///tmp/note.md"]) {
      expect(skillAreaInputSchema.safeParse({
        ...completeArea,
        visibility: "PRIVATE",
        skills: [{
          ...completeArea.skills[0],
          visibility: "PRIVATE",
          evidence: [{ kind: "ARTICLE", titleZh: "文章", url }],
        }],
      }).success).toBe(false);
    }
  });

  it("requires at least one evidence item for a public skill", () => {
    const result = skillAreaInputSchema.safeParse({
      ...completeArea,
      skills: [{ ...completeArea.skills[0], evidence: [] }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toContain("skills.0.evidence");
    }
  });
});

describe("skill capability service", () => {
  it("preserves nested database metadata when parsing records", () => {
    const parsed = parseSkillAreaRecord(record());
    expect(parsed).toMatchObject({ id: "area-1" });
    expect(parsed.skills[0]?.id).toBe("skill-1");
    expect(parsed.skills[0]?.evidence.map((item) => item.id)).toEqual(["evidence-1", "evidence-2", "evidence-3"]);
  });

  it("delegates aggregate CRUD operations", async () => {
    const calls: Array<{ type: string; value?: unknown }> = [];
    const current = record();
    const service = createSkillCapabilityService({
      async listAreas() { return []; },
      async findArea() { return current; },
      async createArea(value) { calls.push({ type: "create", value }); return current; },
      async replaceArea(id, value) { calls.push({ type: `replace:${id}`, value }); return current; },
      async deleteArea(id) { calls.push({ type: `delete:${id}` }); return current; },
    }, async () => []);

    await service.create(completeArea);
    await service.update("area-1", { descriptionZh: "更新后的说明" });
    await service.delete("area-1");

    expect(calls.map((call) => call.type)).toEqual(["create", "replace:area-1", "delete:area-1"]);
    expect(calls[1].value).toMatchObject({ descriptionZh: "更新后的说明", nameZh: "后端工程" });
  });

  it("returns public areas with only public skills and resolvable evidence", async () => {
    const publicArea = record({
      skills: [
        completeArea.skills[0],
        { ...completeArea.skills[0], nameZh: "私密技能", visibility: "PRIVATE", evidence: [] },
      ],
    });
    const service = createSkillCapabilityService({
      async listAreas() { return [publicArea, record({ nameZh: "私密域", visibility: "PRIVATE" })]; },
      async findArea() { return null; },
      async createArea() { throw new Error("not used"); },
      async replaceArea() { throw new Error("not used"); },
      async deleteArea() { throw new Error("not used"); },
    }, async () => [{
      id: "project-public",
      slug: "personal-workstation",
      titleZh: "个人工作站",
      titleEn: "Personal Workstation",
      visibility: "PUBLIC",
    }, {
      id: "project-private",
      slug: "private-project",
      titleZh: "私密项目",
      titleEn: "Private Project",
      visibility: "PRIVATE",
    }]);

    await expect(service.listPublic()).resolves.toEqual([expect.objectContaining({
      nameZh: "后端工程",
      skills: [expect.objectContaining({
        nameZh: "Java 服务端",
        evidence: [
          expect.objectContaining({ kind: "PROJECT", url: "/projects/personal-workstation" }),
          expect.objectContaining({ kind: "ARTICLE", url: "https://example.com/backend-review" }),
        ],
      })],
    })]);
  });

  it("drops public skills and areas when none of their evidence resolves", async () => {
    const area = record({
      skills: [{
        ...completeArea.skills[0],
        evidence: [{ kind: "PROJECT", projectId: "private-project", sortOrder: 0 }],
      }],
    });
    const service = createSkillCapabilityService({
      async listAreas() { return [area]; },
      async findArea() { return null; },
      async createArea() { throw new Error("not used"); },
      async replaceArea() { throw new Error("not used"); },
      async deleteArea() { throw new Error("not used"); },
    }, async () => []);

    await expect(service.listPublic()).resolves.toEqual([]);
  });
});
