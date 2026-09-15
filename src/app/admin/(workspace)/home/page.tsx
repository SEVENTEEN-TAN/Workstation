import { HomeWorkspace } from "@/components/admin/HomeWorkspace";
import type { AssetData, SiteVersionData } from "@/components/admin/types";
import { currentSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { getSiteContentService } from "@/lib/services/site-content";

export default async function AdminHomePage() {
  const session = await currentSession();
  const site = await getSiteContentService();
  const [draft, versions, assets] = await Promise.all([
    site.getOrCreateDraft(session?.userId),
    site.listVersions(),
    (await getDatabase()).asset.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const initialData = JSON.parse(JSON.stringify({ draft, versions, assets })) as {
    draft: SiteVersionData;
    versions: SiteVersionData[];
    assets: AssetData[];
  };

  return <HomeWorkspace initialDraft={initialData.draft} initialVersions={initialData.versions} assets={initialData.assets} />;
}
