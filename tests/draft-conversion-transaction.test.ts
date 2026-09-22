import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createWeeklyActivityDraftService } from "../src/lib/services/weekly-activity-drafts";
import { createOkrMilestoneDraftService } from "../src/lib/services/okr-milestone-drafts";
import { createCareerTimelineDraftService } from "../src/lib/services/career-timeline-drafts";
import { careerActivityInputSchema } from "../src/lib/validators/career-activities";

const { getDatabase } = vi.hoisted(() => ({ getDatabase: vi.fn() }));
vi.mock("../src/lib/db", () => ({ getDatabase }));

let database: PrismaClient;
let directory: string;
const copy = { titleZh: "草稿", titleEn: "Draft", summaryZh: "摘要", summaryEn: "Summary", sourceSnapshot: {} };
const date = new Date("2026-09-20T00:00:00Z");

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "workstation-conversion-test-"));
  const databasePath = join(directory, "test.db");
  await writeFile(databasePath, "");
  const url = `file:${databasePath.replaceAll("\\", "/")}`;
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
    env: { ...process.env, DATABASE_URL: url }, stdio: "pipe",
  });
  database = new PrismaClient({ datasourceUrl: url });
  getDatabase.mockResolvedValue(database);
}, 30_000);

afterAll(async () => {
  await database?.$disconnect();
  if (directory && dirname(resolve(directory)) === resolve(tmpdir()) && basename(directory).startsWith("workstation-conversion-test-")) {
    await rm(directory, { recursive: true, force: true });
  }
});

const cases = [
  {
    name: "weekly", table: "weekly_activity_drafts", service: () => createWeeklyActivityDraftService(),
    seed: (id: string, summaryZh: string) => database.weeklyActivityDraft.create({ data: { ...copy, id, summaryZh, weekStart: new Date(date.getTime() + seedOffset++ * 86_400_000), weekEnd: date } }),
    read: (id: string) => database.weeklyActivityDraft.findUniqueOrThrow({ where: { id } }),
  },
  {
    name: "milestone", table: "okr_milestone_drafts", service: () => createOkrMilestoneDraftService(),
    seed: (id: string, summaryZh: string) => database.okrMilestoneDraft.create({ data: { ...copy, id, summaryZh, sourceKey: id, kind: "KR_PROGRESS", occurredAt: date } }),
    read: (id: string) => database.okrMilestoneDraft.findUniqueOrThrow({ where: { id } }),
  },
  {
    name: "timeline", table: "career_timeline_drafts", service: () => createCareerTimelineDraftService(),
    seed: (id: string, summaryZh: string) => database.careerTimelineDraft.create({ data: { ...copy, id, summaryZh, sourceKey: id, kind: "ARTICLE", occurredAt: date } }),
    read: (id: string) => database.careerTimelineDraft.findUniqueOrThrow({ where: { id } }),
  },
];
let seedOffset = 0;

describe.each(cases)("$name real SQLite conversion", ({ name, table, service, seed, read }) => {
  it("keeps overlong copy editable and creates no activity", async () => {
    const id = `${name}-long`;
    await seed(id, "长".repeat(1001));
    const count = await database.careerActivity.count();
    await expect(service().convert(id)).rejects.toThrow("中文摘要不能超过 1000 字");
    expect(await read(id)).toMatchObject({ status: "DRAFT", summaryZh: "长".repeat(1001), convertedActivityId: null });
    expect(await database.careerActivity.count()).toBe(count);
  });

  it("creates one valid linked activity and refuses repeat conversion", async () => {
    const id = `${name}-valid`;
    await seed(id, "文".repeat(1000));
    const count = await database.careerActivity.count();
    await service().convert(id);
    const draft = await read(id);
    expect(draft.status).toBe("CONVERTED");
    const activity = await database.careerActivity.findUniqueOrThrow({ where: { id: draft.convertedActivityId! } });
    expect(careerActivityInputSchema.parse(activity)).toMatchObject({ summaryZh: "文".repeat(1000), visibility: "PRIVATE", featured: false });
    await expect(service().convert(id)).rejects.toThrow("已经转换");
    expect(await database.careerActivity.count()).toBe(count + 1);
  });

  it("rolls back activity creation if linking the draft fails", async () => {
    const id = `${name}-rollback`;
    await seed(id, "原始摘要");
    const count = await database.careerActivity.count();
    // Table and trigger names are fixed test fixtures in an isolated database.
    await database.$executeRawUnsafe(`CREATE TRIGGER reject_${name} BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'conversion rollback test'); END`);
    try {
      await expect(service().convert(id)).rejects.toThrow();
      expect(await database.careerActivity.count()).toBe(count);
      expect(await read(id)).toMatchObject({ status: "DRAFT", convertedActivityId: null, summaryZh: "原始摘要" });
    } finally {
      await database.$executeRawUnsafe(`DROP TRIGGER reject_${name}`);
    }
  });
});

describe("weekly draft optimistic save", () => {
  it("rejects a second save from the same version and keeps the first writer", async () => {
    const original = await database.weeklyActivityDraft.create({
      data: {
        ...copy,
        id: "weekly-concurrent-save",
        weekStart: new Date("2027-01-04T00:00:00Z"),
        weekEnd: new Date("2027-01-10T00:00:00Z"),
        updatedAt: new Date("2020-01-01T00:00:00Z"),
      },
    });
    const service = createWeeklyActivityDraftService();
    const first = { expectedUpdatedAt: original.updatedAt.toISOString(), titleZh: "第一份", titleEn: "First", summaryZh: "第一份已保存", summaryEn: "First saved" };
    const second = { ...first, titleZh: "第二份", summaryZh: "第二份不应覆盖" };

    await service.update(original.id, first);
    await expect(service.update(original.id, second)).rejects.toMatchObject({ status: 409 });

    await expect(database.weeklyActivityDraft.findUniqueOrThrow({ where: { id: original.id } })).resolves.toMatchObject({
      titleZh: "第一份",
      summaryZh: "第一份已保存",
    });
  });
});
