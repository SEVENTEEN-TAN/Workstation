import { createHash } from "node:crypto";
import { basename, posix } from "node:path";

import { knowledgeGraphSchema, type KnowledgeGraph } from "./graph-contract";
import { scanVault } from "./vault-scanner";

function key(value: string) { return value.replace(/\\/g, "/").replace(/\.md$/i, "").normalize("NFC").toLowerCase(); }
function stripNonLinks(markdown: string) {
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").replace(/<!--[\s\S]*?-->/g, "");
  let fence: { character: string; length: number } | null = null;
  return body.split(/\r?\n/).map((line) => {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (match) {
      if (!fence) fence = { character: match[1][0], length: match[1].length };
      else if (match[1][0] === fence.character && match[1].length >= fence.length) fence = null;
      return "";
    }
    return fence || /^(?: {4}|\t)/.test(line) ? "" : line.replace(/(`+)[\s\S]*?\1/g, "");
  }).join("\n");
}

// Only extracts note references. Bodies/aliases/paths stay within the local scan.
function targets(markdown: string) {
  const text = stripNonLinks(markdown);
  const values = [...text.matchAll(/!?\[\[([^\]\r\n]+)\]\]/g)].map((match) => ({ value: match[1].split("|")[0].split("#")[0].trim(), relative: false }));
  for (const match of text.matchAll(/(?<!!)\[[^\]\r\n]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^\r\n]*["'])?\s*\)/g)) {
    let value = match[1].replace(/^<|>$/g, "").split("#")[0];
    try { value = decodeURIComponent(value); } catch { continue; }
    values.push({ value, relative: true });
  }
  return values.filter(({ value }) => value && !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value));
}

export async function exportKnowledgeGraph(rootPath: string, ignorePatterns: readonly string[] = []): Promise<{ graph: KnowledgeGraph; diagnostics: { unresolvedLinks: number; ambiguousLinks: number } }> {
  const scan = await scanVault(rootPath, [".*", "Temp", "temp", "Skill", "skill", "*.excalidraw.md", ...ignorePatterns]);
  const byPath = new Map<string, Set<string>>();
  for (const note of scan.notes) {
    const paths = byPath.get(key(note.relativePath)) ?? new Set<string>();
    paths.add(note.relativePath); byPath.set(key(note.relativePath), paths);
  }
  const lookup = new Map<string, Set<string>>();
  const add = (name: string, path: string) => { const paths = lookup.get(key(name)) ?? new Set<string>(); paths.add(path); lookup.set(key(name), paths); };
  for (const note of scan.notes) {
    add(note.fileName, note.relativePath);
    const aliases = note.frontmatter?.aliases;
    for (const alias of Array.isArray(aliases) ? aliases : typeof aliases === "string" ? [aliases] : []) if (typeof alias === "string") add(alias, note.relativePath);
  }
  const id = (path: string) => createHash("sha256").update(path.normalize("NFC")).digest("hex");
  const nodes = scan.notes.map((note) => ({ id: id(note.relativePath), title: basename(note.fileName).replace(/\.md$/i, ""), category: note.relativePath.includes("/") ? note.relativePath.split("/")[0] : "未分类" }));
  const edges = new Map<string, { source: string; target: string }>();
  const diagnostics = { unresolvedLinks: 0, ambiguousLinks: 0 };
  for (const note of scan.notes) {
    for (const target of targets(note.markdown)) {
      const raw = target.value.replace(/\\/g, "/");
      const local = posix.normalize(posix.join(note.directoryPath || ".", raw));
      const root = posix.normalize(raw.replace(/^\/+/, ""));
      const relativeTarget = raw.startsWith("./") || raw.startsWith("../") || target.relative;
      const directPaths = !local.startsWith("../") && !raw.startsWith("/") ? byPath.get(key(local)) : undefined;
      const rootPaths = !root.startsWith("../") ? byPath.get(key(root)) : undefined;
      const matchedPaths = directPaths ?? (relativeTarget ? undefined : rootPaths);
      if (matchedPaths && matchedPaths.size > 1) { diagnostics.ambiguousLinks++; continue; }
      // Markdown links are relative. Wiki links prefer the source directory, then the vault path.
      let resolved = matchedPaths ? [...matchedPaths][0] : undefined;
      if (!resolved && !relativeTarget && !raw.includes("/")) {
        const candidates = lookup.get(key(raw));
        if (candidates?.size === 1) resolved = [...candidates][0];
        else if (candidates && candidates.size > 1) { diagnostics.ambiguousLinks++; continue; }
      }
      if (!resolved) {
        if (!/\.(?:png|jpe?g|gif|webp|svg|bmp|avif|pdf|mp[34]|wav|ogg|zip|canvas|excalidraw)$/i.test(raw)) diagnostics.unresolvedLinks++;
        continue;
      }
      if (resolved === note.relativePath) continue;
      const edge = { source: id(note.relativePath), target: id(resolved) };
      edges.set(`${edge.source}:${edge.target}`, edge);
    }
  }
  return { graph: knowledgeGraphSchema.parse({ version: 1, generatedAt: scan.scannedAt.toISOString(), nodes, edges: [...edges.values()].sort((a, b) => `${a.source}:${a.target}`.localeCompare(`${b.source}:${b.target}`)) }), diagnostics };
}
