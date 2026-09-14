import { HomeExperience } from "@/components/public/HomeExperience";
import { fallbackSiteContent } from "@/components/public/data";
import { getPublishedSiteContent } from "@/lib/services/public-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = (await getPublishedSiteContent()) ?? fallbackSiteContent;
  return <HomeExperience content={content} />;
}
