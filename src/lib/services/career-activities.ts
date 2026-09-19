import type { Prisma } from "@prisma/client";

import { getDatabase } from "../db";
import { careerActivityInputSchema, careerActivityPatchSchema } from "../validators/career-activities";

export type CareerActivityRecord = {
  id: string;
  titleZh: string;
  titleEn: string | null;
  summaryZh: string;
  summaryEn: string | null;
  occurredAt: Date;
  visibility: string;
  featured: boolean;
  linkUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type CareerActivityRepository = {
  listActivities(): Promise<CareerActivityRecord[]>;
  listPublicActivities(): Promise<CareerActivityRecord[]>;
  findActivity(id: string): Promise<CareerActivityRecord | null>;
  createActivity(value: Prisma.CareerActivityCreateInput): Promise<unknown>;
  updateActivity(id: string, value: Prisma.CareerActivityUpdateInput): Promise<unknown>;
  deleteActivity(id: string): Promise<unknown>;
};

function defaultRepository(): CareerActivityRepository {
  return {
    async listActivities() {
      return (await getDatabase()).careerActivity.findMany({ orderBy: [{ featured: "desc" }, { occurredAt: "desc" }] });
    },
    async listPublicActivities() {
      return (await getDatabase()).careerActivity.findMany({
        where: { visibility: "PUBLIC" },
        orderBy: [{ featured: "desc" }, { occurredAt: "desc" }],
      });
    },
    async findActivity(id) {
      return (await getDatabase()).careerActivity.findUnique({ where: { id } });
    },
    async createActivity(value) {
      return (await getDatabase()).careerActivity.create({ data: value });
    },
    async updateActivity(id, value) {
      return (await getDatabase()).careerActivity.update({ where: { id }, data: value });
    },
    async deleteActivity(id) {
      return (await getDatabase()).careerActivity.delete({ where: { id } });
    },
  };
}

export function createCareerActivityService(repository?: CareerActivityRepository) {
  const source = repository ?? defaultRepository();
  return {
    list: () => source.listActivities(),
    create: (input: unknown) => source.createActivity(careerActivityInputSchema.parse(input)),
    async update(id: string, input: unknown) {
      const patch = careerActivityPatchSchema.parse(input);
      const current = await source.findActivity(id);
      if (!current) throw new Error("职业动态不存在");
      const complete = careerActivityInputSchema.parse({ ...current, ...patch });
      const values: Prisma.CareerActivityUpdateInput = {};
      if (patch.titleZh !== undefined) values.titleZh = complete.titleZh;
      if (patch.titleEn !== undefined) values.titleEn = complete.titleEn;
      if (patch.summaryZh !== undefined) values.summaryZh = complete.summaryZh;
      if (patch.summaryEn !== undefined) values.summaryEn = complete.summaryEn;
      if (patch.occurredAt !== undefined) values.occurredAt = complete.occurredAt;
      if (patch.visibility !== undefined) values.visibility = complete.visibility;
      if (patch.featured !== undefined) values.featured = complete.featured;
      if (patch.linkUrl !== undefined) values.linkUrl = complete.linkUrl;
      return source.updateActivity(id, values);
    },
    delete: (id: string) => source.deleteActivity(id),
    async listPublic() {
      return (await source.listPublicActivities())
        .filter((item) => item.visibility === "PUBLIC" && item.titleEn && item.summaryEn)
        .sort((left, right) => Number(right.featured) - Number(left.featured)
          || right.occurredAt.getTime() - left.occurredAt.getTime());
    },
  };
}

export const careerActivityService = createCareerActivityService();
