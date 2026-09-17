export type KnowledgeTask = { title: string; completed: boolean };

export function extractKnowledgeTasks(markdown: string): KnowledgeTask[] {
  return markdown.split(/\r?\n/).flatMap((line) => {
    const match = /^\s*(?:[-*+]\s+)\[([ xX])\]\s+(.+?)\s*$/.exec(line);
    return match ? [{ title: match[2], completed: match[1].toLocaleLowerCase() === "x" }] : [];
  });
}
