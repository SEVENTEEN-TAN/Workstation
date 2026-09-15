import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { currentSession } from "@/lib/auth/session";

export default async function AdminWorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/admin/login");

  return <AdminShell username={session.user.username}>{children}</AdminShell>;
}
