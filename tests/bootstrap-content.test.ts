import { describe, expect, it } from "vitest";

import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import { seedPublishedSiteVersion } from "../src/lib/content/seed";
import { siteContentSchema } from "../src/lib/content/schema";

describe("bootstrap site content", () => {
  it("is schema-valid and retains the four bilingual projects", () => {
    expect(siteContentSchema.safeParse(bootstrapSiteContent).success).toBe(true);
    expect(bootstrapSiteContent.en.projects.map((project) => project.image)).toEqual([
      "/images/projects/neon-system.webp",
      "/images/projects/analog-archive.webp",
      "/images/projects/signal-editorial.webp",
      "/images/projects/vertical-habitat.webp",
    ]);
    expect(bootstrapSiteContent.zh.projects).toHaveLength(4);
  });

  it("seeds one published version even when called twice", async () => {
    let existing: unknown = null;
    const created: Array<Record<string, unknown>> = [];
    const repository = {
      siteVersion: {
        findFirst: async () => existing,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          existing = data;
          created.push(data);
          return data;
        },
      },
    };

    await seedPublishedSiteVersion(repository, "admin-1");
    await seedPublishedSiteVersion(repository, "admin-1");

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      version: 1,
      status: "PUBLISHED",
      content: bootstrapSiteContent,
      createdById: "admin-1",
    });
    expect(created[0].publishedAt).toBeInstanceOf(Date);
  });
});
