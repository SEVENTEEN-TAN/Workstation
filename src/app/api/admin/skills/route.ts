import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";
import { skillCapabilityService } from "@/lib/services/skill-capabilities";

export async function GET() {
  return withAdminSession(async () => Response.json(await skillCapabilityService.list()));
}

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      return Response.json(await skillCapabilityService.create(await readJson(request)), { status: 201 });
    } catch (error) {
      return jsonError(error);
    }
  });
}
