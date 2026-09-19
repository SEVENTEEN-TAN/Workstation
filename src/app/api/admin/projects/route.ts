import { portfolioProjectService } from "@/lib/services/portfolio-projects";
import { withAdminSession } from "@/lib/services/auth-guard";
import { jsonError, readJson } from "@/lib/services/http";

export async function GET() {
  return withAdminSession(async () => Response.json(await portfolioProjectService.list()));
}

export async function POST(request: Request) {
  return withAdminSession(async () => {
    try {
      return Response.json(await portfolioProjectService.create(await readJson(request)), { status: 201 });
    } catch (error) {
      return jsonError(error);
    }
  }, request);
}
