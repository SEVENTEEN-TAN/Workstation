import { ZodError } from "zod";

export function jsonError(error: unknown) {
  if (error instanceof Response) return error;
  if (error instanceof ZodError) return Response.json({ error: "VALIDATION_ERROR", issues: error.issues }, { status: 400 });
  return Response.json({ error: error instanceof Error ? error.message : "请求处理失败" }, { status: 400 });
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new Error("请求体必须是有效 JSON");
  }
}
