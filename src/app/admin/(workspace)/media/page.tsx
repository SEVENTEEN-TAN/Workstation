import { MediaWorkspace } from "@/components/admin/MediaWorkspace";
import type { AssetData } from "@/components/admin/types";
import { getDatabase } from "@/lib/db";

export default async function AdminMediaPage() {
  const assets = JSON.parse(JSON.stringify(
    await (await getDatabase()).asset.findMany({ orderBy: { createdAt: "desc" } }),
  )) as AssetData[];

  return <MediaWorkspace initialAssets={assets} />;
}
