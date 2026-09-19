import { SkillAreasWorkspace } from "@/components/admin/SkillAreasWorkspace";
import { portfolioProjectService } from "@/lib/services/portfolio-projects";
import { skillCapabilityService } from "@/lib/services/skill-capabilities";

export default async function AdminSkillsPage() {
  const [areas, projects] = await Promise.all([
    skillCapabilityService.list(),
    portfolioProjectService.list(),
  ]);

  return (
    <SkillAreasWorkspace
      initialAreas={areas}
      projects={projects}
    />
  );
}
