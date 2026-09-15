import { describe, expect, it } from "vitest";

import { createPortfolioProjectService, parsePortfolioProjectRecord } from "../src/lib/services/portfolio-projects";
import { portfolioProjectInputSchema } from "../src/lib/validators/portfolio-projects";

const completeProject = {
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
  technologies: [" Next.js ", "TypeScript", "Next.js"],
  links: [{ kind: "WEBSITE", labelZh: "线上站点", labelEn: "Live site", url: "https://sqtan.com" }],
  visibility: "PUBLIC",
  featured: true,
  sortOrder: 2,
  startedAt: "2026-09-01",
  completedAt: null,
};

describe("portfolio project validation", () => {
  it("normalizes slug, technologies and nested links", () => {
    expect(portfolioProjectInputSchema.parse({ ...completeProject, slug: "  Personal Workstation  " })).toMatchObject({
      slug: "personal-workstation",
      technologies: ["Next.js", "TypeScript"],
      links: [{ kind: "WEBSITE", labelZh: "线上站点", labelEn: "Live site", url: "https://sqtan.com/" }],
      startedAt: new Date("2026-09-01"),
      completedAt: null,
    });
  });

  it("requires complete English evidence before publication", () => {
    const result = portfolioProjectInputSchema.safeParse({
      ...completeProject,
      titleEn: "",
      approachEn: null,
      coverAltEn: "",
      links: [{ kind: "SOURCE", labelZh: "源码", labelEn: "", url: "https://github.com/example/repo" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual([
        "titleEn",
        "approachEn",
        "coverAltEn",
        "links.0.labelEn",
      ]);
    }
  });

  it("accepts blank dates as null values", () => {
    expect(portfolioProjectInputSchema.parse({ ...completeProject, startedAt: "", completedAt: "" })).toMatchObject({
      startedAt: null,
      completedAt: null,
    });
  });
});

describe("portfolio project service", () => {
  it("preserves database timestamps when parsing records", () => {
    const createdAt = new Date("2026-09-15T00:00:00.000Z");
    const updatedAt = new Date("2026-09-16T00:00:00.000Z");

    expect(parsePortfolioProjectRecord({ ...completeProject, id: "project-1", createdAt, updatedAt })).toMatchObject({
      id: "project-1",
      createdAt,
      updatedAt,
    });
  });

  it("delegates validated CRUD operations", async () => {
    const calls: Array<{ type: string; value?: unknown }> = [];
    const current = { id: "project-1", createdAt: new Date(), updatedAt: new Date(), ...portfolioProjectInputSchema.parse(completeProject) };
    const service = createPortfolioProjectService({
      async listProjects() { return []; },
      async listPublicProjects() { return []; },
      async findProject() { return current; },
      async findPublicProjectBySlug() { return null; },
      async createProject(value) { calls.push({ type: "create", value }); return { id: "project-1", ...value }; },
      async updateProject(id, value) { calls.push({ type: `update:${id}`, value }); return { id, ...value }; },
      async deleteProject(id) { calls.push({ type: `delete:${id}` }); return { id }; },
      async countSkillEvidence() { return 0; },
    });

    await service.create(completeProject);
    await service.update("project-1", { featured: false });
    await service.delete("project-1");

    expect(calls.map((call) => call.type)).toEqual(["create", "update:project-1", "delete:project-1"]);
    expect(calls[0].value).toMatchObject({ slug: "personal-workstation", visibility: "PUBLIC", featured: true });
    expect(calls[1].value).toEqual({ featured: false });
  });

  it("returns only complete public projects in featured order", async () => {
    const publicProject = { id: "public", createdAt: new Date(), updatedAt: new Date(), ...portfolioProjectInputSchema.parse(completeProject) };
    const laterProject = { ...publicProject, id: "later", slug: "later", featured: false, sortOrder: 0 };
    const privateProject = { ...publicProject, id: "private", slug: "private", visibility: "PRIVATE" };
    const incompleteProject = { ...publicProject, id: "incomplete", slug: "incomplete", titleEn: null };
    const service = createPortfolioProjectService({
      async listProjects() { return []; },
      async listPublicProjects() { return [laterProject, privateProject, incompleteProject, publicProject]; },
      async findProject() { return null; },
      async findPublicProjectBySlug(slug) { return slug === "personal-workstation" ? publicProject : privateProject; },
      async createProject() { throw new Error("not used"); },
      async updateProject() { throw new Error("not used"); },
      async deleteProject() { throw new Error("not used"); },
      async countSkillEvidence() { return 0; },
    });

    await expect(service.listPublic()).resolves.toMatchObject([{ id: "public" }, { id: "later" }]);
    await expect(service.getPublicBySlug("personal-workstation")).resolves.toMatchObject({ id: "public" });
    await expect(service.getPublicBySlug("private")).resolves.toBeNull();
  });

  it("prevents deleting a project that is used as skill evidence", async () => {
    const service = createPortfolioProjectService({
      async listProjects() { return []; },
      async listPublicProjects() { return []; },
      async findProject() { return null; },
      async findPublicProjectBySlug() { return null; },
      async createProject() { throw new Error("not used"); },
      async updateProject() { throw new Error("not used"); },
      async deleteProject() { throw new Error("project should not be deleted"); },
      async countSkillEvidence(projectId) {
        expect(projectId).toBe("project-1");
        return 1;
      },
    });

    await expect(service.delete("project-1")).rejects.toThrow("项目仍被能力证据引用");
  });
});
