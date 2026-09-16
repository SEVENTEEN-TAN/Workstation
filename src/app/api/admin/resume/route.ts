import { getResumeFileService } from "@/lib/services/resume-files";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError } from "@/lib/services/http";

export async function GET() {
  return withAdminSession(async () => Response.json(await (await getResumeFileService()).list()));
}

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("请选择 PDF 文件");
      return Response.json(await (await getResumeFileService()).upload(form.get("locale"), file));
    } catch (error) {
      return jsonError(error);
    }
  });
}
