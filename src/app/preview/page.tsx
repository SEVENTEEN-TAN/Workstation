import { HomeExperience } from "@/components/public/HomeExperience";
import { currentSession } from "@/lib/auth/session";
import { getSiteContentService } from "@/lib/services/site-content";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  if (!(await currentSession())) redirect("/admin/login");
  const { id } = await searchParams;
  if (!id) redirect("/admin");
  const version = await (await getSiteContentService()).getVersion(id);
  return <HomeExperience content={version.content} />;
}
