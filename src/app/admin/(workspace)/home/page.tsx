import { HomeWorkspace } from "@/components/admin/HomeWorkspace";
import { currentSession } from "@/lib/auth/session";
import { getAssetLibraryService } from "@/lib/services/assets";
import { portfolioProjectService } from "@/lib/services/portfolio-projects";
import { getSiteContentService } from "@/lib/services/site-content";
import { getPublicResumeDataForContent } from "@/lib/services/public-resume";
import { siteContentSchema } from "@/lib/content/schema";

export default async function AdminHomePage() {
  const session = await currentSession();
  const site = await getSiteContentService();
  const [draft, versions, assets, projects] = await Promise.all([
    site.getOrCreateDraft(session?.userId),
    site.listVersions(),
    (await getAssetLibraryService()).list(),
    portfolioProjectService.list(),
  ]);

  const sources = await getPublicResumeDataForContent(siteContentSchema.parse(draft.content));
  const sourceOptions = {
    activities: sources.activities.map(({ id, titleZh }) => ({ id, label: titleZh })),
    skills: sources.skills.map(({ id, nameZh }) => ({ id, label: nameZh })),
    experiences: sources.experiences.map((record) => ({ id: record.id, label: record.titleZh })),
  };
  return (
    <HomeWorkspace
      initialDraft={draft}
      initialVersions={versions}
      initialProjects={projects}
      assets={assets}
      sourceOptions={sourceOptions}
    />
  );
}
