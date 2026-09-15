import { withAdminSession } from "@/lib/services/auth-guard";
import { experienceRecordService } from "@/lib/services/experience-records";
import { jsonError, readJson } from "@/lib/services/http";

export async function GET() {
  return withAdminSession(async () => Response.json(await experienceRecordService.list()));
}

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      return Response.json(
        await experienceRecordService.create(await readJson(request)),
        { status: 201 },
      );
    } catch (error) {
      return jsonError(error);
    }
  });
}
