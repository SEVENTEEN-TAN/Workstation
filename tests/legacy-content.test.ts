import { describe, expect, it } from "vitest";

import { migrateLegacySiteContent } from "../src/lib/content/legacy";
import { siteContentSchema } from "../src/lib/content/schema";

describe("migrateLegacySiteContent", () => {
  it("places each legacy project's localized fields into both locale snapshots", () => {
    const sections = {
      meta: {},
      nav: {},
      hero: {},
      about: {},
      works: {},
      services: {},
      footer: {},
    };
    const content = { en: sections, zh: sections };
    const projects = [
      {
        image: "/image.webp",
        en: { category: "EN category", title: "EN title", description: "EN description", tags: ["EN"], alt: "EN alt" },
        zh: { category: "ZH category", title: "ZH title", description: "ZH description", tags: ["ZH"], alt: "ZH alt" },
      },
    ];

    const migrated = migrateLegacySiteContent(content, projects);

    expect(migrated.en.projects[0]).toEqual({ image: "/image.webp", ...projects[0].en });
    expect(migrated.zh.projects[0]).toEqual({ image: "/image.webp", ...projects[0].zh });
  });

  it("produces a schema-valid snapshot from the real HomePage data", async () => {
    const [{ content }, { projects }] = await Promise.all([
      import("../../HomePage/src/data/content.js"),
      import("../../HomePage/src/data/projects.js"),
    ]);

    expect(siteContentSchema.safeParse(migrateLegacySiteContent(content, projects)).success).toBe(true);
  });
});
