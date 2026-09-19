import { HomeWorkspace } from "@/components/admin/HomeWorkspace";
import { currentSession } from "@/lib/auth/session";
import { getAssetLibraryService } from "@/lib/services/assets";
import { portfolioProjectService } from "@/lib/services/portfolio-projects";
import { getSiteContentService } from "@/lib/services/site-content";

export default async function AdminHomePage() {
  const session = await currentSession();
  const site = await getSiteContentService();
  const [draft, versions, assets, projects] = await Promise.all([
    site.getOrCreateDraft(session?.userId),
    site.listVersions(),
    (await getAssetLibraryService()).list(),
    portfolioProjectService.list(),
  ]);

  return (
    <HomeWorkspace
      initialDraft={draft}
      initialVersions={versions}
      initialProjects={projects}
      assets={assets}
    />
  );
}
