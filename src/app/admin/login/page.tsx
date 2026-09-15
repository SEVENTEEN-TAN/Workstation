import { currentSession } from "@/lib/auth/session";
import { hasAdministrator } from "@/lib/auth/bootstrap";
import { AuthFrame } from "@/components/admin/AuthFrame";
import { sanitizeAdminReturnPath } from "@/components/admin/navigation";
import { redirect } from "next/navigation";

import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const nextPath = sanitizeAdminReturnPath(Array.isArray(next) ? next[0] : next);

  if (await currentSession()) redirect(nextPath);
  if (!(await hasAdministrator())) redirect("/admin/setup");
  return (
    <AuthFrame
      eyebrow="SECURE ACCESS"
      title="管理后台"
      description="使用管理员账号进入内容与目标控制台。"
    >
      <LoginForm nextPath={nextPath} />
    </AuthFrame>
  );
}
