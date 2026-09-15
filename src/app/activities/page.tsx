import type { Metadata } from "next";

import { ActivityExperience, type PublicCareerActivity } from "@/components/public/ActivityExperience";
import { fallbackSiteContent } from "@/components/public/data";
import { careerActivityService } from "@/lib/services/career-activities";
import { getPublishedSiteContent } from "@/lib/services/public-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Activity — SEVENTEEN Personal Workstation",
  description: "Recent professional activity and career milestones from SEVENTEEN.",
};

export default async function ActivitiesPage() {
  const [content, records] = await Promise.all([getPublishedSiteContent(), careerActivityService.listPublic()]);
  const activities = records.map((record) => ({
    id: record.id,
    titleZh: record.titleZh,
    titleEn: record.titleEn!,
    summaryZh: record.summaryZh,
    summaryEn: record.summaryEn!,
    occurredAt: record.occurredAt.toISOString(),
    featured: record.featured,
    linkUrl: record.linkUrl ?? null,
  })) satisfies PublicCareerActivity[];
  return <ActivityExperience content={content ?? fallbackSiteContent} activities={activities} />;
}
