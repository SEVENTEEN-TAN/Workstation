import { currentSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { okrService } from "@/lib/services/okr";
import { getSiteContentService } from "@/lib/services/site-content";
import { redirect } from "next/navigation";

import { AdminWorkspace } from "./AdminWorkspace";

export default async function AdminPage() {
  const session = await currentSession();
  if (!session) redirect("/admin/login");
  const site = await getSiteContentService();
  const [dashboard, draft, versions, cycles, assets] = await Promise.all([
    okrService.getDashboard(),
    site.getOrCreateDraft(session.userId),
    site.listVersions(),
    okrService.listAll(),
    (await getDatabase()).asset.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const initialData = JSON.parse(JSON.stringify({ dashboard, draft, versions, cycles, assets })) as unknown;
  return <AdminWorkspace username={session.user.username} initialData={initialData} />;
}
