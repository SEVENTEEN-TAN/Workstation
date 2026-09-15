import { HomeWorkspace } from "@/components/admin/HomeWorkspace";
import type { SiteVersionData } from "@/components/admin/types";
import { currentSession } from "@/lib/auth/session";
import { getSiteContentService } from "@/lib/services/site-content";

export default async function AdminHomePage() {
  const session = await currentSession();
  const site = await getSiteContentService();
  const [draft, versions] = await Promise.all([
    site.getOrCreateDraft(session?.userId),
    site.listVersions(),
  ]);
  const initialData = JSON.parse(JSON.stringify({ draft, versions })) as {
    draft: SiteVersionData;
    versions: SiteVersionData[];
  };

  return <HomeWorkspace initialDraft={initialData.draft} initialVersions={initialData.versions} />;
}
