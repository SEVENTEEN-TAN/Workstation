import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/AdminShell";
import { currentSession } from "@/lib/auth/session";
import { getSiteContentService } from "@/lib/services/site-content";

export default async function AdminWorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/admin/login");
  const published = await (await getSiteContentService()).getPublished();

  return <AdminShell username={session.user.username} brandImage={published?.settings.portraitImage}>{children}</AdminShell>;
}
