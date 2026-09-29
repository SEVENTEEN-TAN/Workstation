import { isDeepStrictEqual } from "node:util";

import { calculateKeyResultProgress } from "../okr/progress";
import { knowledgeVaultService, type KnowledgeSourceRevisionData } from "./knowledge-vaults";
import { okrService } from "./okr";
import { getSiteContentService } from "./site-content";

export type OverviewQueueItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
};

export type OverviewQueueData = {
  todayActions: OverviewQueueItem[];
  overdueKeyResults: OverviewQueueItem[];
  pendingReviews: OverviewQueueItem[];
  pendingPublications: OverviewQueueItem[];
};

function shanghaiDate(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function progressFor(keyResult: {
  progressMode: string;
  startValue: number | null;
  currentValue: number | null;
  targetValue: number | null;
  manualProgress: number | null;
}) {
  return keyResult.progressMode === "MANUAL"
    ? calculateKeyResultProgress({ mode: "MANUAL", manualProgress: keyResult.manualProgress ?? 0 })
    : calculateKeyResultProgress({
      mode: "METRIC",
      startValue: keyResult.startValue ?? 0,
      currentValue: keyResult.currentValue ?? keyResult.startValue ?? 0,
      targetValue: keyResult.targetValue ?? 0,
    });
}

function knowledgeHref(vaultId: string, revisionId?: string) {
  const query = new URLSearchParams({ vault: vaultId });
  if (revisionId) query.set("revision", revisionId);
  return `/admin/knowledge?${query.toString()}`;
}

function latestByPath(revisions: KnowledgeSourceRevisionData[]) {
  const grouped = new Map<string, KnowledgeSourceRevisionData[]>();
  for (const revision of revisions) {
    const current = grouped.get(revision.relativePath) ?? [];
    current.push(revision);
    grouped.set(revision.relativePath, current);
  }
  return [...grouped.values()].map((items) => items.sort((left, right) => (
    new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime()
  )));
}

export async function getOverviewQueue(now = new Date()): Promise<OverviewQueueData> {
  const [cycles, vaults, siteVersions] = await Promise.all([
    okrService.listAll(),
    knowledgeVaultService.list(),
    (async () => (await getSiteContentService()).listVersions())(),
  ]);
  const today = shanghaiDate(now);
  const todayActions: OverviewQueueItem[] = [];
  const overdueKeyResults: OverviewQueueItem[] = [];

  for (const cycle of cycles) {
    if (cycle.status === "COMPLETED" || cycle.status === "ARCHIVED") continue;
    for (const objective of cycle.objectives) {
      if (objective.status === "COMPLETED" || objective.status === "CANCELLED") continue;
      const objectiveHref = `/admin/okr/cycles/${encodeURIComponent(cycle.id)}/objectives/${encodeURIComponent(objective.id)}`;
      for (const keyResult of objective.keyResults) {
        if (keyResult.status === "DONE" || keyResult.status === "COMPLETED" || keyResult.status === "CANCELLED") continue;
        for (const action of keyResult.actionItems) {
          if (action.dueDate && action.status !== "DONE" && action.status !== "CANCELLED" && shanghaiDate(action.dueDate) === today) {
            todayActions.push({
              id: action.id,
              label: action.titleZh,
              detail: `${cycle.nameZh} / ${objective.titleZh} / ${keyResult.titleZh}`,
              href: `${objectiveHref}#action-${encodeURIComponent(action.id)}`,
            });
          }
        }

        const progress = progressFor(keyResult);
        const deadline = [objective.endDate, cycle.endDate]
          .filter((date): date is Date => date instanceof Date && shanghaiDate(date) < today)
          .sort((left, right) => left.getTime() - right.getTime())[0];
        if (deadline && progress < 100) {
          overdueKeyResults.push({
            id: keyResult.id,
            label: keyResult.titleZh,
            detail: `${cycle.nameZh} / ${objective.titleZh} · 截止 ${shanghaiDate(deadline)} · ${progress}%`,
            href: `${objectiveHref}#key-result-${encodeURIComponent(keyResult.id)}`,
          });
        }
      }
    }
  }

  const pendingReviews: OverviewQueueItem[] = vaults.flatMap((vault) => (
    vault.syncReports[0]?.changes
      .filter((change) => (change.type === "MODIFIED" || change.type === "MISSING") && !change.reviewDecision)
      .map((change) => ({
        id: change.id,
        label: change.currentRelativePath ?? change.previousRelativePath ?? "未知路径",
        detail: `${vault.name} · ${change.type === "MODIFIED" ? "已修改" : "疑似缺失"}`,
        href: `${knowledgeHref(vault.id)}#sync-change-${encodeURIComponent(change.id)}`,
      })) ?? []
  ));

  const pendingPublications: OverviewQueueItem[] = [];
  const latestDraft = siteVersions.filter((version) => version.status === "DRAFT").sort((left, right) => right.version - left.version)[0];
  const latestPublished = siteVersions.filter((version) => version.status === "PUBLISHED").sort((left, right) => right.version - left.version)[0];
  if (latestDraft && (!latestPublished || !isDeepStrictEqual(latestDraft.content, latestPublished.content))) {
    pendingPublications.push({
      id: latestDraft.id,
      label: "首页草稿待发布",
      detail: `版本 ${latestDraft.version} 有未发布修改`,
      href: "/admin/home",
    });
  }

  for (const vault of vaults) {
    const indexedPaths = new Set(vault.notes.map((note) => note.relativePath));
    for (const revisions of latestByPath(vault.sourceRevisions)) {
      const latest = revisions[0];
      if (!indexedPaths.has(latest.relativePath)) continue;
      const published = revisions.find((revision) => revision.draft?.article);
      const draftPending = Boolean(latest.draft && !latest.draft.article);
      const updatePending = Boolean(published && latest.id !== published.id && latest.contentHash !== published.contentHash);
      if (!draftPending && !updatePending) continue;
      pendingPublications.push({
        id: latest.id,
        label: latest.draft?.title ?? published?.draft?.title ?? latest.relativePath,
        detail: `${vault.name} / ${latest.relativePath} · ${draftPending ? "草稿待发布" : "已发布内容有更新"}`,
        href: `${knowledgeHref(vault.id, latest.id)}#revision-${encodeURIComponent(latest.id)}`,
      });
    }
  }

  return { todayActions, overdueKeyResults, pendingReviews, pendingPublications };
}
