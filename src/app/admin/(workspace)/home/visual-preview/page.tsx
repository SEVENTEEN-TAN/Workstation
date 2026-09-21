import { HomeVisualEditor } from "@/components/public/HomeVisualEditor";
import { currentSession } from "@/lib/auth/session";
import { getSiteContentService } from "@/lib/services/site-content";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomeVisualPreviewPage() {
  const session = await currentSession();
  if (!session) redirect("/admin/login");
  const draft = await (await getSiteContentService()).getOrCreateDraft(session.userId);
  return <HomeVisualEditor initialContent={draft.content} />;
}
