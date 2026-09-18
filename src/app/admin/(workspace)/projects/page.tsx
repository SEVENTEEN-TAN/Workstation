import { PortfolioProjectsWorkspace } from "@/components/admin/PortfolioProjectsWorkspace";
import type { AiContentDraftData, AssetData, PortfolioProjectData } from "@/components/admin/types";
import { aiContentDraftService } from "@/lib/services/ai-content-drafts";
import { getAssetLibraryService } from "@/lib/services/assets";
import { portfolioProjectService } from "@/lib/services/portfolio-projects";

export default async function AdminProjectsPage() {
  const [projects, assets, drafts] = await Promise.all([
    portfolioProjectService.list(),
    (await getAssetLibraryService()).list(),
    aiContentDraftService.list("PROJECT_DESCRIPTION"),
  ]);

  return <PortfolioProjectsWorkspace
    initialProjects={JSON.parse(JSON.stringify(projects)) as PortfolioProjectData[]}
    assets={JSON.parse(JSON.stringify(assets)) as AssetData[]}
    initialAiDrafts={JSON.parse(JSON.stringify(drafts)) as AiContentDraftData[]}
  />;
}
