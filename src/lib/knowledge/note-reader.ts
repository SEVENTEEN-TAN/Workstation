import { readFile, realpath } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const UNAVAILABLE = new Error("Note unavailable");

function isWithinRoot(rootPath: string, candidatePath: string) {
  return candidatePath.startsWith(`${rootPath}${sep}`);
}

export async function readIndexedMarkdownNote(rootPath: string, relativePath: string) {
  try {
    const vaultRoot = await realpath(rootPath);
    const candidatePath = resolve(vaultRoot, relativePath);
    if (!isWithinRoot(vaultRoot, candidatePath) || extname(candidatePath).toLowerCase() !== ".md") throw UNAVAILABLE;

    const safePath = await realpath(candidatePath);
    if (!isWithinRoot(vaultRoot, safePath)) throw UNAVAILABLE;
    return { content: await readFile(safePath, "utf8") };
  } catch (error) {
    if (error === UNAVAILABLE) throw error;
    throw new Error("Note unavailable");
  }
}
