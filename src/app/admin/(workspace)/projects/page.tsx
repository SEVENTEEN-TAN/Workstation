import { PortfolioProjectsWorkspace } from "@/components/admin/PortfolioProjectsWorkspace";
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
    initialProjects={projects}
    assets={assets}
    initialAiDrafts={drafts.flatMap((draft) => draft.useCase === "PROJECT_DESCRIPTION" ? [draft] : [])}
  />;
}
