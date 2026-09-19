import { MediaWorkspace } from "@/components/admin/MediaWorkspace";
import { getAssetLibraryService } from "@/lib/services/assets";

export default async function AdminMediaPage() {
  return <MediaWorkspace initialAssets={await (await getAssetLibraryService()).list()} />;
}
