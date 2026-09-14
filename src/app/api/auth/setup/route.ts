import { bootstrapAdmin } from "@/lib/auth/bootstrap";
import { z } from "zod";

const setupSchema = z.object({
  username: z.string().trim().min(3),
  password: z.string().min(12),
});

export async function POST(request: Request) {
  try {
    const input = setupSchema.parse(await request.json());
    const user = await bootstrapAdmin(input);
    return Response.json({ id: user.id, username: user.username }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "初始化失败";
    return Response.json({ error: message }, { status: message === "管理员已初始化" ? 409 : 400 });
  }
}
