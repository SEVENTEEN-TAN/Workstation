import { HomeWorkspace } from "@/components/admin/HomeWorkspace";
import type { AssetData, PortfolioProjectData, SiteVersionData } from "@/components/admin/types";
import { currentSession } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { portfolioProjectService } from "@/lib/services/portfolio-projects";
import { getSiteContentService } from "@/lib/services/site-content";

export default async function AdminHomePage() {
  const session = await currentSession();
  const site = await getSiteContentService();
  const [draft, versions, assets, projects] = await Promise.all([
    site.getOrCreateDraft(session?.userId),
    site.listVersions(),
    (await getDatabase()).asset.findMany({ orderBy: { createdAt: "desc" } }),
    portfolioProjectService.list(),
  ]);
  const initialData = JSON.parse(JSON.stringify({ draft, versions, assets, projects })) as {
    draft: SiteVersionData;
    versions: SiteVersionData[];
    assets: AssetData[];
    projects: PortfolioProjectData[];
  };

  return (
    <HomeWorkspace
      initialDraft={initialData.draft}
      initialVersions={initialData.versions}
      initialProjects={initialData.projects}
      assets={initialData.assets}
    />
  );
}
