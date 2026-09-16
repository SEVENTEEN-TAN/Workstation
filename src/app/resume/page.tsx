import type { Metadata } from "next";

import { PrintableResume } from "@/components/public/PrintableResume";
import { SiteUninitialized } from "@/components/public/SiteUninitialized";
import { getPublicResumeData } from "@/lib/services/public-resume";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resume | SEVENTEEN",
  description: "A printable overview of SEVENTEEN's experience, projects, and engineering capabilities.",
};

export default async function ResumePage() {
  const data = await getPublicResumeData();
  if (!data) return <SiteUninitialized />;
  return <PrintableResume data={data} />;
}
