import type { Metadata } from "next";

import { ExperienceTimeline, type PublicExperienceRecord } from "@/components/public/ExperienceTimeline";
import { fallbackSiteContent } from "@/components/public/data";
import { experienceRecordService } from "@/lib/services/experience-records";
import { getPublishedSiteContent } from "@/lib/services/public-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journey | SEVENTEEN",
  description: "SEVENTEEN's public work and education experience timeline.",
};

export default async function ExperiencePage() {
  const [content, records] = await Promise.all([
    getPublishedSiteContent(),
    experienceRecordService.listPublic(),
  ]);
  const experiences = records.map((record) => ({
    id: record.id,
    kind: record.kind,
    organizationZh: record.organizationZh,
    organizationEn: record.organizationEn!,
    titleZh: record.titleZh,
    titleEn: record.titleEn!,
    descriptionZh: record.descriptionZh,
    descriptionEn: record.descriptionEn!,
    locationZh: record.locationZh,
    locationEn: record.locationEn,
    linkUrl: record.linkUrl,
    startedAt: record.startedAt.toISOString(),
    endedAt: record.endedAt ? record.endedAt.toISOString() : null,
    isCurrent: record.isCurrent,
    featured: record.featured,
    sortOrder: record.sortOrder,
  })) satisfies PublicExperienceRecord[];

  return <ExperienceTimeline content={content ?? fallbackSiteContent} experiences={experiences} />;
}
