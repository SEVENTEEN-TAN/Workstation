import { HomeExperience } from "@/components/public/HomeExperience";
import { SiteUninitialized } from "@/components/public/SiteUninitialized";
import { getPublicResumeData } from "@/lib/services/public-resume";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getPublicResumeData();
  if (!data) return <SiteUninitialized />;

  return <HomeExperience
    content={data.content}
    activities={data.activities}
    skills={data.skills}
    experiences={data.experiences}
    resumeDownloads={data.downloads}
  />;
}
