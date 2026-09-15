import { HomeExperience } from "@/components/public/HomeExperience";
import { SiteUninitialized } from "@/components/public/SiteUninitialized";
import { getPublishedSiteContent } from "@/lib/services/public-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = await getPublishedSiteContent();
  if (!content) return <SiteUninitialized />;

  return <HomeExperience content={content} />;
}
