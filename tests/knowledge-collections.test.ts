import { describe, expect, it } from "vitest";

import { createKnowledgeCollectionService } from "../src/lib/services/knowledge-collections";

const publicArticle = { id: "article-1", slug: "java", title: "Java", summary: null, tags: ["Java"], publishedAt: new Date("2026-09-17T00:00:00.000Z") };

describe("knowledge collection service", () => {
  it("keeps supplied published article order when creating a collection", async () => {
    const writes: Array<{ articleIds: string[] }> = [];
    const service = createKnowledgeCollectionService({
      async listAdmin() { return []; },
      async listPublishedArticles() { return [publicArticle, { ...publicArticle, id: "article-2", slug: "ai" }]; },
      async findAdmin() { return null; },
      async create(value) { writes.push(value); return { id: "collection-1", ...value }; },
      async update() { throw new Error("not used"); },
      async remove() { throw new Error("not used"); },
      async listPublic() { return []; },
      async getPublic() { return null; },
    });

    await expect(service.create({ title: " Java Notes ", slug: "java-notes", visibility: "PUBLIC", articleIds: ["article-2", "article-1"] }))
      .resolves.toMatchObject({ slug: "java-notes", visibility: "PUBLIC" });
    expect(writes).toEqual([expect.objectContaining({ title: "Java Notes", articleIds: ["article-2", "article-1"] })]);
  });

  it("does not expose a private collection through the public read path", async () => {
    const service = createKnowledgeCollectionService({
      async listAdmin() { return []; },
      async listPublishedArticles() { return [publicArticle]; },
      async findAdmin() { return null; },
      async create() { throw new Error("not used"); },
      async update() { throw new Error("not used"); },
      async remove() { throw new Error("not used"); },
      async listPublic() { return []; },
      async getPublic(slug) { return slug === "private" ? null : { id: "collection-1", slug, title: "Public", description: null, articles: [publicArticle] }; },
    });

    await expect(service.getPublic("private")).resolves.toBeNull();
    await expect(service.getPublic("public")).resolves.toMatchObject({ slug: "public", articles: [expect.objectContaining({ id: "article-1" })] });
  });

  it("rejects duplicate or unpublished article selection", async () => {
    const service = createKnowledgeCollectionService({
      async listAdmin() { return []; },
      async listPublishedArticles() { return [publicArticle]; },
      async findAdmin() { return null; },
      async create() { throw new Error("not used"); },
      async update() { throw new Error("not used"); },
      async remove() { throw new Error("not used"); },
      async listPublic() { return []; },
      async getPublic() { return null; },
    });

    await expect(service.create({ title: "Java", slug: "java", visibility: "PUBLIC", articleIds: ["article-1", "article-1"] })).rejects.toThrow();
    await expect(service.create({ title: "Java", slug: "java", visibility: "PUBLIC", articleIds: ["missing"] })).rejects.toThrow("文章不存在或尚未发布");
  });
});
