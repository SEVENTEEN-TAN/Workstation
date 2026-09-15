import type { Metadata } from "next";

import { ProjectExperience } from "@/components/public/ProjectExperience";
import { fallbackSiteContent, toPublicPortfolioProject } from "@/components/public/data";
import { getPublishedSiteContent } from "@/lib/services/public-data";
import { portfolioProjectService } from "@/lib/services/portfolio-projects";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Projects | SEVENTEEN",
  description: "Structured project evidence for SEVENTEEN's Java and AI engineering work.",
};

export default async function ProjectsPage() {
  const [content, projects] = await Promise.all([
    getPublishedSiteContent(),
    portfolioProjectService.listPublic(),
  ]);

  return <ProjectExperience
    content={content ?? fallbackSiteContent}
    projects={projects.map(toPublicPortfolioProject)}
  />;
}
