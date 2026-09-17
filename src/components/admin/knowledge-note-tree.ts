import type { KnowledgeNoteData } from "./types";

export type KnowledgeTreeItem = KnowledgeTreeDirectory | KnowledgeTreeNote;

export interface KnowledgeTreeDirectory {
  kind: "directory";
  name: string;
  path: string;
  children: KnowledgeTreeItem[];
}

export interface KnowledgeTreeNote {
  kind: "note";
  name: string;
  note: KnowledgeNoteData;
}

interface DirectoryDraft {
  name: string;
  path: string;
  directories: Map<string, DirectoryDraft>;
  notes: KnowledgeNoteData[];
}

function sortByName<T extends { name: string }>(items: T[]) {
  return items.sort((left, right) => left.name.localeCompare(right.name));
}

function toTree(directory: DirectoryDraft): KnowledgeTreeItem[] {
  const directories = sortByName([...directory.directories.values()].map((child) => ({
    kind: "directory" as const,
    name: child.name,
    path: child.path,
    children: toTree(child),
  })));
  const notes = sortByName(directory.notes.map((note) => ({
    kind: "note" as const,
    name: note.fileName,
    note,
  })));
  return [...directories, ...notes];
}

export function buildKnowledgeNoteTree(notes: KnowledgeNoteData[]) {
  const root: DirectoryDraft = { name: "", path: "", directories: new Map(), notes: [] };

  for (const note of notes) {
    let directory = root;
    for (const segment of note.directoryPath.split("/").filter(Boolean)) {
      const path = directory.path ? `${directory.path}/${segment}` : segment;
      let child = directory.directories.get(segment);
      if (!child) {
        child = { name: segment, path, directories: new Map(), notes: [] };
        directory.directories.set(segment, child);
      }
      directory = child;
    }
    directory.notes.push(note);
  }

  return toTree(root);
}

function formatProperty(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")) {
    return value.join(", ");
  }
  return null;
}

export function readKnowledgeProperties(note: KnowledgeNoteData): Array<[string, string]> {
  if (!note.frontmatterJson) return [];
  try {
    const value: unknown = JSON.parse(note.frontmatterJson);
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    return Object.entries(value).flatMap(([key, item]) => {
      const formatted = formatProperty(item);
      return formatted === null ? [] : [[key, formatted] as [string, string]];
    });
  } catch {
    return [];
  }
}
