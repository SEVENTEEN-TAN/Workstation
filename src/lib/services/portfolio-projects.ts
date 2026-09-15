import type { Prisma } from "@prisma/client";

import { getDatabase } from "../db";
import { portfolioProjectInputSchema, portfolioProjectPatchSchema, type PortfolioProjectInput } from "../validators/portfolio-projects";

export type PortfolioProjectRecord = PortfolioProjectInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PortfolioProjectRepository = {
  listProjects(): Promise<PortfolioProjectRecord[]>;
  listPublicProjects(): Promise<PortfolioProjectRecord[]>;
  findProject(id: string): Promise<PortfolioProjectRecord | null>;
  findPublicProjectBySlug(slug: string): Promise<PortfolioProjectRecord | null>;
  createProject(value: PortfolioProjectInput): Promise<unknown>;
  updateProject(id: string, value: Partial<PortfolioProjectInput>): Promise<unknown>;
  deleteProject(id: string): Promise<unknown>;
};

export function parsePortfolioProjectRecord(record: unknown): PortfolioProjectRecord {
  const value = portfolioProjectInputSchema.parse(record);
  const metadata = record as { id?: unknown; createdAt?: unknown; updatedAt?: unknown };
  const createdAt = new Date(metadata.createdAt as string | Date);
  const updatedAt = new Date(metadata.updatedAt as string | Date);
  if (typeof metadata.id !== "string" || Number.isNaN(createdAt.getTime()) || Number.isNaN(updatedAt.getTime())) {
    throw new Error("项目记录元数据不完整");
  }

  return { ...value, id: metadata.id, createdAt, updatedAt };
}

const deserialize = parsePortfolioProjectRecord;

function writeData(value: PortfolioProjectInput) {
  return { ...value, technologies: value.technologies as Prisma.InputJsonValue, links: value.links as Prisma.InputJsonValue };
}

function defaultRepository(): PortfolioProjectRepository {
  return {
    async listProjects() {
      const records = await (await getDatabase()).portfolioProject.findMany({ orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }] });
      return records.map(deserialize);
    },
    async listPublicProjects() {
      const records = await (await getDatabase()).portfolioProject.findMany({
        where: { visibility: "PUBLIC" },
        orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
      });
      return records.map(deserialize);
    },
    async findProject(id) {
      const record = await (await getDatabase()).portfolioProject.findUnique({ where: { id } });
      return record ? deserialize(record) : null;
    },
    async findPublicProjectBySlug(slug) {
      const record = await (await getDatabase()).portfolioProject.findFirst({ where: { slug, visibility: "PUBLIC" } });
      return record ? deserialize(record) : null;
    },
    createProject(value) {
      return getDatabase().then((database) => database.portfolioProject.create({ data: writeData(value) }));
    },
    updateProject(id, value) {
      const data = {
        ...value,
        ...(value.technologies ? { technologies: value.technologies as Prisma.InputJsonValue } : {}),
        ...(value.links ? { links: value.links as Prisma.InputJsonValue } : {}),
      };
      return getDatabase().then((database) => database.portfolioProject.update({ where: { id }, data }));
    },
    deleteProject(id) {
      return getDatabase().then((database) => database.portfolioProject.delete({ where: { id } }));
    },
  };
}

function isPublicReady(record: PortfolioProjectRecord) {
  return record.visibility === "PUBLIC" && portfolioProjectInputSchema.safeParse(record).success;
}

export function createPortfolioProjectService(repository?: PortfolioProjectRepository) {
  const source = repository ?? defaultRepository();
  return {
    list: () => source.listProjects(),
    create: (input: unknown) => {
      const value = portfolioProjectInputSchema.parse(input);
      return source.createProject(value);
    },
    async update(id: string, input: unknown) {
      const patch = portfolioProjectPatchSchema.parse(input);
      const current = await source.findProject(id);
      if (!current) throw new Error("项目不存在");
      const complete = portfolioProjectInputSchema.parse({ ...current, ...patch });
      const values = Object.fromEntries(Object.keys(patch).map((key) => [key, complete[key as keyof PortfolioProjectInput]]));
      return source.updateProject(id, values);
    },
    delete: (id: string) => source.deleteProject(id),
    async listPublic() {
      return (await source.listPublicProjects()).filter(isPublicReady).sort((left, right) => (
        Number(right.featured) - Number(left.featured)
        || left.sortOrder - right.sortOrder
        || right.updatedAt.getTime() - left.updatedAt.getTime()
      ));
    },
    async getPublicBySlug(slug: string) {
      const record = await source.findPublicProjectBySlug(slug);
      return record && isPublicReady(record) ? record : null;
    },
  };
}

export const portfolioProjectService = createPortfolioProjectService();
