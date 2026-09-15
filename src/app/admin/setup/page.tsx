import { hasAdministrator } from "@/lib/auth/bootstrap";
import { AuthFrame } from "@/components/admin/AuthFrame";
import { redirect } from "next/navigation";

import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAdministrator()) redirect("/admin/login");
  return (
    <AuthFrame
      eyebrow="FIRST RUN"
      title="初始化管理后台"
      description="创建唯一的管理员账号。完成后该入口会自动关闭。"
    >
      <SetupForm />
    </AuthFrame>
  );
}
