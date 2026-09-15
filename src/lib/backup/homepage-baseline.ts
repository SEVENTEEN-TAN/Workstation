import { siteContentSchema } from "../content/schema";
import { findAssetReferences } from "../services/assets";

type SiteVersionSource = {
  id: string;
  version: number;
  status: string;
  content: unknown;
  publishedAt: Date | null;
};

type AssetSource = {
  id: string;
  originalFilename: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  width?: number | null;
  height?: number | null;
  altTextZh?: string | null;
  altTextEn?: string | null;
};

function latestVersion(versions: SiteVersionSource[], status: string) {
  const version = versions
    .filter((item) => item.status === status)
    .sort((left, right) => right.version - left.version)[0];

  return version ? { ...version, content: siteContentSchema.parse(version.content) } : null;
}

export function buildHomepageBaseline(versions: SiteVersionSource[], assets: AssetSource[]) {
  return {
    capturedAt: new Date().toISOString(),
    published: latestVersion(versions, "PUBLISHED"),
    draft: latestVersion(versions, "DRAFT"),
    assets: assets.map((asset) => ({
      ...asset,
      references: findAssetReferences(asset.id, versions),
    })),
  };
}
