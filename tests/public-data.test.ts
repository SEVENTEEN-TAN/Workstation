import { describe, expect, it } from "vitest";

import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import {
  createPublicDataAdapter,
  type PublicOkrCycleRecord,
} from "../src/components/public/data";

describe("public data adapter", () => {
  it("returns null when no publication exists", async () => {
    const adapter = createPublicDataAdapter();

    await expect(adapter.getPublishedSiteContent()).resolves.toBeNull();
    await expect(adapter.getPreviewSiteContent()).resolves.toBeNull();
  });

  it("returns the requested preview version when it exists", async () => {
    const adapter = createPublicDataAdapter({
      loadPreviewSiteContent: async () => bootstrapSiteContent,
    });

    await expect(adapter.getPreviewSiteContent("version-1")).resolves.toEqual(bootstrapSiteContent);
  });

  it("returns an empty public OKR view when no OKR source exists", async () => {
    const adapter = createPublicDataAdapter();

    await expect(adapter.getPublicOkrView()).resolves.toEqual({
      cycles: [],
      summary: {
        averageProgress: 0,
        completedObjectives: 0,
        cycleCount: 0,
        objectiveCount: 0,
      },
    });
  });

  it("filters private records and derives progress without exposing source records", async () => {
    const records: PublicOkrCycleRecord[] = [
      {
        id: "public-cycle",
        nameZh: "2026 第三季度",
        nameEn: "2026 Q3",
        status: "ACTIVE",
        visibility: "PUBLIC",
        startDate: "2026-07-01",
        endDate: "2026-09-30",
        objectives: [
          {
            id: "public-objective",
            titleZh: "完成个人工作站",
            titleEn: "Ship the personal workstation",
            descriptionZh: "把长期目标和公开作品放进同一套系统。",
            descriptionEn: "Bring long-term goals and public work into one system.",
            status: "IN_PROGRESS",
            visibility: "PUBLIC",
            sortOrder: 1,
            keyResults: [
              {
                id: "metric-kr",
                titleZh: "完成公开页面",
                titleEn: "Complete public pages",
                mode: "METRIC",
                startValue: 0,
                currentValue: 6,
                targetValue: 10,
                unit: "页",
                weight: 2,
                status: "IN_PROGRESS",
              },
              {
                id: "manual-kr",
                titleZh: "视觉回归",
                titleEn: "Visual regression",
                mode: "MANUAL",
                manualProgress: 80,
                weight: 1,
                status: "IN_PROGRESS",
              },
            ],
          },
          {
            id: "private-objective",
            titleZh: "私密目标",
            titleEn: "Private objective",
            status: "IN_PROGRESS",
            visibility: "PRIVATE",
            sortOrder: 2,
            keyResults: [],
          },
        ],
        reviews: [
          {
            id: "public-review",
            achievementsZh: "主页迁移完成",
            achievementsEn: "Homepage migration completed",
            problemsZh: "需要补齐端到端测试",
            problemsEn: "End-to-end coverage remains",
            lessonsZh: "先锁定视觉基线",
            lessonsEn: "Capture the visual baseline first",
            nextActionsZh: "完善 OKR 流程",
            nextActionsEn: "Complete the OKR workflow",
            score: 8,
            visibility: "PUBLIC",
            reviewedAt: "2026-09-14",
          },
          {
            id: "private-review",
            achievementsZh: "不应公开",
            achievementsEn: "Must stay private",
            problemsZh: "不应公开",
            problemsEn: "Must stay private",
            lessonsZh: "不应公开",
            lessonsEn: "Must stay private",
            nextActionsZh: "不应公开",
            nextActionsEn: "Must stay private",
            visibility: "PRIVATE",
            reviewedAt: "2026-09-14",
          },
        ],
      },
      {
        id: "private-cycle",
        nameZh: "私密周期",
        nameEn: "Private cycle",
        status: "ACTIVE",
        visibility: "PRIVATE",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        objectives: [],
        reviews: [],
      },
    ];
    const adapter = createPublicDataAdapter({
      loadPublicOkrCycles: async () => records,
    });

    const view = await adapter.getPublicOkrView();

    expect(view.cycles).toHaveLength(1);
    expect(view.cycles[0].objectives).toHaveLength(1);
    expect(view.cycles[0].reviews).toHaveLength(1);
    expect(view.cycles[0].objectives[0].progress).toBe(66.67);
    expect(view.cycles[0].objectives[0].keyResults.map((keyResult) => keyResult.progress)).toEqual([60, 80]);
    expect(view.summary).toEqual({
      averageProgress: 66.67,
      completedObjectives: 0,
      cycleCount: 1,
      objectiveCount: 1,
    });
    expect(JSON.stringify(view)).not.toContain("private-objective");
    expect(JSON.stringify(view)).not.toContain("private-review");
    expect(JSON.stringify(view)).not.toContain("private-cycle");
  });
});
