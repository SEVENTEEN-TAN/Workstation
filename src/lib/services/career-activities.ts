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
  visibility: "PUBLIC" | "PRIVATE";
  featured: boolean;
  linkUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CareerActivityData = Omit<
  CareerActivityRecord,
  "occurredAt" | "createdAt" | "updatedAt"
> & {
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

type CareerActivityRepository = {
  listActivities(): Promise<CareerActivityRecord[]>;
  listPublicActivities(): Promise<CareerActivityRecord[]>;
  findActivity(id: string): Promise<CareerActivityRecord | null>;
  createActivity(value: Prisma.CareerActivityCreateInput): Promise<unknown>;
  updateActivity(id: string, value: Prisma.CareerActivityUpdateInput): Promise<unknown>;
  deleteActivity(id: string): Promise<unknown>;
};

function parseCareerActivityRecord(record: unknown): CareerActivityRecord {
  const value = careerActivityInputSchema.parse(record);
  const metadata = record as { id?: unknown; createdAt?: unknown; updatedAt?: unknown };
  const createdAt = new Date(metadata.createdAt as string | Date);
  const updatedAt = new Date(metadata.updatedAt as string | Date);
  if (typeof metadata.id !== "string" || Number.isNaN(createdAt.getTime()) || Number.isNaN(updatedAt.getTime())) {
    throw new Error("职业动态记录元数据不完整");
  }

  return { ...value, id: metadata.id, createdAt, updatedAt };
}

function defaultRepository(): CareerActivityRepository {
  return {
    async listActivities() {
      return (await getDatabase()).careerActivity.findMany({ orderBy: [{ featured: "desc" }, { occurredAt: "desc" }] }).then(
        (records) => records.map(parseCareerActivityRecord),
      );
    },
    async listPublicActivities() {
      return (await getDatabase()).careerActivity.findMany({
        where: { visibility: "PUBLIC" },
        orderBy: [{ featured: "desc" }, { occurredAt: "desc" }],
      }).then((records) => records.map(parseCareerActivityRecord));
    },
    async findActivity(id) {
      const record = await (await getDatabase()).careerActivity.findUnique({ where: { id } });
      return record ? parseCareerActivityRecord(record) : null;
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
  const toAdminActivity = (activity: CareerActivityRecord): CareerActivityData => ({
    ...activity,
    occurredAt: activity.occurredAt.toISOString(),
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  });

  return {
    list: async () => (await source.listActivities()).map(toAdminActivity),
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
