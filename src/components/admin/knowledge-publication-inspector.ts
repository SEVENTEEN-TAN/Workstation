import type { KnowledgeNoteData, KnowledgeNoteLinkData } from "./types";

export type PublicationCheckStatus = "READY" | "BLOCKED" | "NOTICE";

export interface PublicationCheck {
  id: "visibility" | "title" | "links" | "attachments" | "dataview";
  status: PublicationCheckStatus;
  label: string;
}

function hasTitle(note: KnowledgeNoteData) {
  if (!note.frontmatterJson) return false;
  try {
    const value: unknown = JSON.parse(note.frontmatterJson);
    return Boolean(value && typeof value === "object" && "title" in value && typeof value.title === "string" && value.title.trim());
  } catch {
    return false;
  }
}

export function inspectKnowledgePublication(note: KnowledgeNoteData, links: KnowledgeNoteLinkData[]): PublicationCheck[] {
  const outgoing = links.filter((link) => link.sourceRelativePath === note.relativePath);
  const titled = hasTitle(note);
  const hasUnresolvedLinks = outgoing.some((link) => !link.isResolved);
  const hasAttachments = outgoing.some((link) => link.kind === "EMBED");
  return [
    { id: "visibility", status: note.visibility === "PRIVATE" ? "READY" : "BLOCKED", label: note.visibility === "PRIVATE" ? "源笔记保持私有" : "源笔记不应直接公开" },
    { id: "title", status: titled ? "READY" : "BLOCKED", label: titled ? "已提供标题" : "frontmatter 缺少标题" },
    { id: "links", status: hasUnresolvedLinks ? "BLOCKED" : "READY", label: hasUnresolvedLinks ? "存在未解析链接" : "链接均可解析" },
    { id: "attachments", status: hasAttachments ? "BLOCKED" : "READY", label: hasAttachments ? "附件需单独选择后才能发布" : "不含待选择附件" },
    { id: "dataview", status: note.hasDataview ? "NOTICE" : "READY", label: note.hasDataview ? "Dataview 仅保留为静态代码" : "不含 Dataview 查询" },
  ];
}
