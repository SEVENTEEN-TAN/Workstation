import { MediaWorkspace } from "@/components/admin/MediaWorkspace";
import type { AssetData } from "@/components/admin/types";
import { getAssetLibraryService } from "@/lib/services/assets";

export default async function AdminMediaPage() {
  const assets = JSON.parse(JSON.stringify(
    await (await getAssetLibraryService()).list(),
  )) as AssetData[];

  return <MediaWorkspace initialAssets={assets} />;
}
