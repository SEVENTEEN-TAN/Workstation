import type { SiteContent } from "./schema";
import { bootstrapSiteContent } from "./bootstrap";

type SiteVersionSeedRepository = {
  siteVersion: {
    findFirst(): Promise<unknown | null>;
    create(input: {
      data: {
        version: number;
        status: "PUBLISHED";
        content: SiteContent;
        createdById?: string | null;
        publishedAt: Date;
      };
    }): Promise<unknown>;
  };
};

export async function seedPublishedSiteVersion(
  repository: SiteVersionSeedRepository,
  createdById?: string | null,
) {
  if (await repository.siteVersion.findFirst()) return;

  return repository.siteVersion.create({
    data: {
      version: 1,
      status: "PUBLISHED",
      content: bootstrapSiteContent,
      createdById,
      publishedAt: new Date(),
    },
  });
}
