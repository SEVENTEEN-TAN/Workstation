import { readFile } from "node:fs/promises";

import { getResumeFileService, resolveResumeStoragePath } from "@/lib/services/resume-files";

type Context = { params: Promise<{ locale: string }> };

export async function GET(request: Request, context: Context) {
  const value = (await context.params).locale.toLowerCase();
  if (value !== "zh" && value !== "en") return new Response("Not found", { status: 404 });

  const record = await (await getResumeFileService()).findPublic(value.toUpperCase());
  if (!record) return new Response("Not found", { status: 404 });

  const etag = `"${record.sha256}"`;
  const headers = {
    "content-type": "application/pdf",
    "content-disposition": `attachment; filename="resume-${value}.pdf"`,
    "cache-control": "public, max-age=0, must-revalidate",
    etag,
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  try {
    return new Response(await readFile(resolveResumeStoragePath(record.storagePath)), { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
