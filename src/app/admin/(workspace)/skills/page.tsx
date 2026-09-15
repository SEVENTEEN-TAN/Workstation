import { SkillAreasWorkspace } from "@/components/admin/SkillAreasWorkspace";
import type { PortfolioProjectData, SkillAreaData } from "@/components/admin/types";
import { portfolioProjectService } from "@/lib/services/portfolio-projects";
import { skillCapabilityService } from "@/lib/services/skill-capabilities";

export default async function AdminSkillsPage() {
  const [areas, projects] = await Promise.all([
    skillCapabilityService.list(),
    portfolioProjectService.list(),
  ]);

  return (
    <SkillAreasWorkspace
      initialAreas={JSON.parse(JSON.stringify(areas)) as SkillAreaData[]}
      projects={JSON.parse(JSON.stringify(projects)) as PortfolioProjectData[]}
    />
  );
}
