import { HomeExperience } from "@/components/public/HomeExperience";
import { SiteUninitialized } from "@/components/public/SiteUninitialized";
import { toPublicPortfolioProject } from "@/components/public/data";
import { getPublishedSiteContent } from "@/lib/services/public-data";
import { portfolioProjectService } from "@/lib/services/portfolio-projects";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [content, projects] = await Promise.all([
    getPublishedSiteContent(),
    portfolioProjectService.listPublic(),
  ]);
  if (!content) return <SiteUninitialized />;

  return <HomeExperience
    content={content}
    projects={projects.map(toPublicPortfolioProject)}
  />;
}
