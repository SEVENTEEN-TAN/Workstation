import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ActionItemList } from "../src/components/admin/okr/ActionItemList";
import { ObjectiveWorkspace } from "../src/components/admin/okr/ObjectiveWorkspace";
import { KnowledgeWorkspace } from "../src/components/admin/KnowledgeWorkspace";
import type { ActionItemData, ObjectiveDetailData } from "../src/components/admin/types";
import type { KnowledgeVaultData } from "../src/lib/services/knowledge-vaults";

const timestamp = "2026-09-29T00:00:00.000Z";

it("lands overview action and KR links on the matching records", () => {
  const action = { id: "action-1", titleZh: "检查页面", status: "TODO", dueDate: timestamp, recurrenceType: "NONE" } as ActionItemData;
  const actionMarkup = renderToStaticMarkup(createElement(ActionItemList, { keyResultId: "kr-1", items: [action] }));
  expect(actionMarkup).toContain('id="action-action-1"');

  const objective = {
    id: "objective-1", cycleId: "cycle-1", titleZh: "交付工作站", titleEn: null,
    descriptionZh: null, descriptionEn: null, status: "IN_PROGRESS", visibility: "PRIVATE", sortOrder: 0,
    startDate: null, endDate: null, createdAt: timestamp, updatedAt: timestamp, reviews: [],
    cycle: { id: "cycle-1", nameZh: "2026 Q3", nameEn: null, type: "QUARTER", startDate: timestamp,
      endDate: "2026-09-30T00:00:00.000Z", status: "ACTIVE", visibility: "PRIVATE", createdAt: timestamp, updatedAt: timestamp },
    keyResults: [{ id: "kr-1", objectiveId: "objective-1", titleZh: "完成仪表盘", titleEn: null,
      descriptionZh: null, descriptionEn: null, progressMode: "MANUAL", startValue: null, currentValue: null,
      targetValue: null, unit: null, manualProgress: 50, weight: 1, status: "IN_PROGRESS", sortOrder: 0,
      createdAt: timestamp, updatedAt: timestamp, progressUpdates: [], actionItems: [action] }],
  } satisfies ObjectiveDetailData;
  const objectiveMarkup = renderToStaticMarkup(createElement(ObjectiveWorkspace, { initialObjective: objective }));
  expect(objectiveMarkup).toContain('id="key-result-kr-1"');
});

it("opens the selected vault and revision with review and publication anchors", () => {
  const vaults = [{
    id: "vault-1", name: "Personal Tech", rootPath: "C:/vault", enabled: true, lastScanStatus: "SUCCESS",
    lastScanFileCount: 1, lastScanError: null, notes: [{ id: "note-1", relativePath: "a.md", directoryPath: "", fileName: "a.md",
      frontmatterJson: null, visibility: "PRIVATE", isMoc: false, hasFrontmatter: false, hasWikilinks: false,
      hasEmbeds: false, hasCallouts: false, hasDataview: false, hasTasks: false, sizeBytes: 3,
      modifiedAt: timestamp, indexedAt: timestamp, contentHash: "hash-1" }], noteLinks: [],
    sourceRevisions: [{ id: "revision-1", relativePath: "a.md", contentHash: "hash-1", capturedAt: timestamp,
      draft: { id: "draft-1", title: "A", attachments: [], article: null } }],
    syncReports: [{ id: "report-1", scannedAt: timestamp, addedCount: 0, modifiedCount: 1, movedCount: 0,
      missingCount: 0, unchangedCount: 0, changes: [{ id: "change-1", type: "MODIFIED", currentRelativePath: "a.md",
        previousRelativePath: "a.md", reviewDecision: null }] }],
  }] as unknown as KnowledgeVaultData[];

  const markup = renderToStaticMarkup(createElement(KnowledgeWorkspace, {
    initialVaults: vaults, initialVaultId: "vault-1", initialRevisionId: "revision-1",
  }));

  expect(markup).toContain('id="sync-change-change-1"');
  expect(markup).toContain('id="revision-revision-1"');
});
