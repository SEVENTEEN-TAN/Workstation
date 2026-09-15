import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { getDatabase } from "@/lib/db";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const asset = await (await getDatabase()).asset.findUnique({ where: { id } });
  if (!asset) return new Response("Not found", { status: 404 });
  const uploadRoot = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? resolve(process.cwd(), "data", "uploads"));
  const storagePath = resolve(asset.storagePath);
  if (!storagePath.startsWith(`${uploadRoot}${sep}`)) return new Response("Invalid path", { status: 400 });
  const etag = `"${asset.sha256}"`;
  const headers = { "content-type": asset.mimeType, "cache-control": "public, max-age=0, must-revalidate", "etag": etag };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  try {
    return new Response(await readFile(storagePath), { headers });
  } catch { return new Response("Not found", { status: 404 }); }
}
