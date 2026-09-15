import { PortfolioProjectsWorkspace } from "@/components/admin/PortfolioProjectsWorkspace";
import type { AssetData, PortfolioProjectData } from "@/components/admin/types";
import { getAssetLibraryService } from "@/lib/services/assets";
import { portfolioProjectService } from "@/lib/services/portfolio-projects";

export default async function AdminProjectsPage() {
  const [projects, assets] = await Promise.all([
    portfolioProjectService.list(),
    (await getAssetLibraryService()).list(),
  ]);

  return <PortfolioProjectsWorkspace
    initialProjects={JSON.parse(JSON.stringify(projects)) as PortfolioProjectData[]}
    assets={JSON.parse(JSON.stringify(assets)) as AssetData[]}
  />;
}
