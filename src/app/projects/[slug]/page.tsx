import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectExperience } from "@/components/public/ProjectExperience";
import { SiteUninitialized } from "@/components/public/SiteUninitialized";
import { toPublicPortfolioProject } from "@/components/public/data";
import { getPublishedSiteContent } from "@/lib/services/public-data";
import { portfolioProjectService } from "@/lib/services/portfolio-projects";

export const dynamic = "force-dynamic";

type ProjectPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const project = await portfolioProjectService.getPublicBySlug((await params).slug);
  if (!project) return { title: "Project not found | SEVENTEEN" };

  return {
    title: `${project.titleEn ?? project.titleZh} | SEVENTEEN`,
    description: project.summaryEn ?? project.summaryZh,
  };
}

export default async function ProjectDetailPage({ params }: ProjectPageProps) {
  const [content, record] = await Promise.all([
    getPublishedSiteContent(),
    portfolioProjectService.getPublicBySlug((await params).slug),
  ]);
  if (!content) return <SiteUninitialized />;
  if (!record) notFound();

  const project = toPublicPortfolioProject(record);
  return <ProjectExperience content={content} projects={[project]} project={project} />;
}
