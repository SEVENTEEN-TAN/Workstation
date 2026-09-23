import { getDatabase } from "../db";
import { getExperiencePublicIssues } from "../public-readiness";
import {
  experienceRecordInputSchema,
  experienceRecordPatchSchema,
  type ExperienceRecordInput,
} from "../validators/experience-records";

export type ExperienceRecord = ExperienceRecordInput & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ExperienceRecordData = Omit<
  ExperienceRecord,
  "startedAt" | "endedAt" | "createdAt" | "updatedAt"
> & {
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExperienceRecordRepository = {
  listRecords(): Promise<ExperienceRecord[]>;
  listPublicRecords(): Promise<ExperienceRecord[]>;
  findRecord(id: string): Promise<ExperienceRecord | null>;
  createRecord(value: ExperienceRecordInput): Promise<unknown>;
  updateRecord(id: string, value: Partial<ExperienceRecordInput>): Promise<unknown>;
  deleteRecord(id: string): Promise<unknown>;
};

export function parseExperienceRecord(record: unknown): ExperienceRecord {
  const value = experienceRecordInputSchema.parse(record);
  const metadata = record as { id?: unknown; createdAt?: unknown; updatedAt?: unknown };
  const createdAt = new Date(metadata.createdAt as string | Date);
  const updatedAt = new Date(metadata.updatedAt as string | Date);
  if (typeof metadata.id !== "string" || Number.isNaN(createdAt.getTime()) || Number.isNaN(updatedAt.getTime())) {
    throw new Error("经历记录元数据不完整");
  }

  return { ...value, id: metadata.id, createdAt, updatedAt };
}

const deserialize = parseExperienceRecord;

function compareExperienceRecords(left: ExperienceRecord, right: ExperienceRecord) {
  return Number(right.featured) - Number(left.featured)
    || Number(right.isCurrent) - Number(left.isCurrent)
    || left.sortOrder - right.sortOrder
    || right.startedAt.getTime() - left.startedAt.getTime()
    || right.updatedAt.getTime() - left.updatedAt.getTime();
}

function defaultRepository(): ExperienceRecordRepository {
  return {
    async listRecords() {
      const records = await (await getDatabase()).experienceRecord.findMany({
        orderBy: [
          { featured: "desc" },
          { isCurrent: "desc" },
          { sortOrder: "asc" },
          { startedAt: "desc" },
          { updatedAt: "desc" },
        ],
      });
      return records.map(deserialize);
    },
    async listPublicRecords() {
      const records = await (await getDatabase()).experienceRecord.findMany({
        where: { visibility: "PUBLIC" },
        orderBy: [
          { featured: "desc" },
          { isCurrent: "desc" },
          { sortOrder: "asc" },
          { startedAt: "desc" },
          { updatedAt: "desc" },
        ],
      });
      return records.map(deserialize);
    },
    async findRecord(id) {
      const record = await (await getDatabase()).experienceRecord.findUnique({ where: { id } });
      return record ? deserialize(record) : null;
    },
    createRecord(value) {
      return getDatabase().then((database) => database.experienceRecord.create({ data: value }));
    },
    updateRecord(id, value) {
      return getDatabase().then((database) => database.experienceRecord.update({ where: { id }, data: value }));
    },
    deleteRecord(id) {
      return getDatabase().then((database) => database.experienceRecord.delete({ where: { id } }));
    },
  };
}

export function createExperienceRecordService(repository?: ExperienceRecordRepository) {
  const source = repository ?? defaultRepository();
  const toAdminRecord = (record: ExperienceRecord): ExperienceRecordData => ({
    ...record,
    startedAt: record.startedAt.toISOString(),
    endedAt: record.endedAt ? record.endedAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });

  return {
    list: async () => (await source.listRecords()).map(toAdminRecord),
    create: (input: unknown) => source.createRecord(experienceRecordInputSchema.parse(input)),
    async update(id: string, input: unknown) {
      const patch = experienceRecordPatchSchema.parse(input);
      const current = await source.findRecord(id);
      if (!current) throw new Error("经历记录不存在");
      const complete = experienceRecordInputSchema.parse({ ...current, ...patch });
      const values = Object.fromEntries(
        Object.keys(patch).map((key) => [key, complete[key as keyof ExperienceRecordInput]]),
      );
      return source.updateRecord(id, values);
    },
    delete: (id: string) => source.deleteRecord(id),
    async listPublic() {
      return (await source.listPublicRecords())
        .filter((record) => getExperiencePublicIssues(record).length === 0)
        .sort(compareExperienceRecords);
    },
  };
}

export const experienceRecordService = createExperienceRecordService();
