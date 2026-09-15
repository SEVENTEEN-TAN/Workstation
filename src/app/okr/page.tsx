import type { Metadata } from "next";

import { OkrExperience } from "@/components/public/OkrExperience";
import { SiteUninitialized } from "@/components/public/SiteUninitialized";
import { toPublicOkrView } from "@/components/public/data";
import { getPublishedSiteContent, getPublicOkrRecords } from "@/lib/services/public-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OKR — SEVENTEEN Personal Workstation",
  description: "Public objectives, key results and reviews from SEVENTEEN's personal workstation.",
};

export default async function OkrPage() {
  const [content, records] = await Promise.all([getPublishedSiteContent(), getPublicOkrRecords()]);
  if (!content) return <SiteUninitialized />;
  return <OkrExperience content={content} view={toPublicOkrView(records)} />;
}
