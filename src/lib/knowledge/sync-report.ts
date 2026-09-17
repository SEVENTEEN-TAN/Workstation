export type KnowledgeNoteSnapshot = {
  relativePath: string;
  contentHash: string;
  modifiedAt: Date;
};

export type KnowledgeSyncChangeInput = {
  type: "ADDED" | "MODIFIED" | "MOVED" | "MISSING";
  previousRelativePath: string | null;
  currentRelativePath: string | null;
  previousContentHash: string | null;
  currentContentHash: string | null;
  previousModifiedAt: Date | null;
  currentModifiedAt: Date | null;
};

export type KnowledgeSyncReportInput = {
  summary: {
    addedCount: number;
    modifiedCount: number;
    movedCount: number;
    missingCount: number;
    unchangedCount: number;
  };
  changes: KnowledgeSyncChangeInput[];
};

function groupByHash(notes: KnowledgeNoteSnapshot[]) {
  const groups = new Map<string, KnowledgeNoteSnapshot[]>();
  for (const note of notes) groups.set(note.contentHash, [...(groups.get(note.contentHash) ?? []), note]);
  return groups;
}

function sortByPath(notes: KnowledgeNoteSnapshot[]) {
  return [...notes].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function buildKnowledgeSyncReport(previousNotes: KnowledgeNoteSnapshot[], nextNotes: KnowledgeNoteSnapshot[]): KnowledgeSyncReportInput {
  const previousByPath = new Map(previousNotes.map((note) => [note.relativePath, note]));
  const nextByPath = new Map(nextNotes.map((note) => [note.relativePath, note]));
  const changes: KnowledgeSyncChangeInput[] = [];
  let unchangedCount = 0;
  let modifiedCount = 0;

  for (const path of [...previousByPath.keys()].filter((path) => nextByPath.has(path)).sort()) {
    const previous = previousByPath.get(path)!;
    const next = nextByPath.get(path)!;
    if (previous.contentHash === next.contentHash) {
      unchangedCount += 1;
      continue;
    }
    modifiedCount += 1;
    changes.push({
      type: "MODIFIED",
      previousRelativePath: previous.relativePath,
      currentRelativePath: next.relativePath,
      previousContentHash: previous.contentHash,
      currentContentHash: next.contentHash,
      previousModifiedAt: previous.modifiedAt,
      currentModifiedAt: next.modifiedAt,
    });
  }

  const missing = sortByPath(previousNotes.filter((note) => !nextByPath.has(note.relativePath)));
  const added = sortByPath(nextNotes.filter((note) => !previousByPath.has(note.relativePath)));
  const movedPrevious = new Set<string>();
  const movedNext = new Set<string>();

  for (const [hash, previousGroup] of groupByHash(missing)) {
    const nextGroup = groupByHash(added).get(hash) ?? [];
    if (previousGroup.length !== 1 || nextGroup.length !== 1) continue;
    const previous = previousGroup[0];
    const next = nextGroup[0];
    movedPrevious.add(previous.relativePath);
    movedNext.add(next.relativePath);
    changes.push({
      type: "MOVED",
      previousRelativePath: previous.relativePath,
      currentRelativePath: next.relativePath,
      previousContentHash: previous.contentHash,
      currentContentHash: next.contentHash,
      previousModifiedAt: previous.modifiedAt,
      currentModifiedAt: next.modifiedAt,
    });
  }

  const remainingAdded = added.filter((note) => !movedNext.has(note.relativePath));
  const remainingMissing = missing.filter((note) => !movedPrevious.has(note.relativePath));
  changes.push(...remainingAdded.map((note) => ({
    type: "ADDED" as const,
    previousRelativePath: null,
    currentRelativePath: note.relativePath,
    previousContentHash: null,
    currentContentHash: note.contentHash,
    previousModifiedAt: null,
    currentModifiedAt: note.modifiedAt,
  })));
  changes.push(...remainingMissing.map((note) => ({
    type: "MISSING" as const,
    previousRelativePath: note.relativePath,
    currentRelativePath: null,
    previousContentHash: note.contentHash,
    currentContentHash: null,
    previousModifiedAt: note.modifiedAt,
    currentModifiedAt: null,
  })));

  return {
    summary: {
      addedCount: remainingAdded.length,
      modifiedCount,
      movedCount: movedPrevious.size,
      missingCount: remainingMissing.length,
      unchangedCount,
    },
    changes,
  };
}
