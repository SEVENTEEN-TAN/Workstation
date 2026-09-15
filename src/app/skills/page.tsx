import type { Metadata } from "next";

import { SkillCapabilitiesExperience } from "@/components/public/SkillCapabilitiesExperience";
import { SiteUninitialized } from "@/components/public/SiteUninitialized";
import { getPublishedSiteContent } from "@/lib/services/public-data";
import { skillCapabilityService } from "@/lib/services/skill-capabilities";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Capabilities | SEVENTEEN",
  description: "SEVENTEEN's capability areas with supporting project and article evidence.",
};

export default async function SkillsPage() {
  const [content, areas] = await Promise.all([
    getPublishedSiteContent(),
    skillCapabilityService.listPublic(),
  ]);

  if (!content) return <SiteUninitialized />;
  return <SkillCapabilitiesExperience content={content} areas={areas} />;
}
