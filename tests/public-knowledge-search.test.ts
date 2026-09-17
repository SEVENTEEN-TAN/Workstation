import { describe, expect, it } from "vitest";

import { filterPublicKnowledgeArticles } from "../src/lib/knowledge/public-article-search";

const articles = [{
  id: "java", slug: "java-concurrency", title: "Java Concurrency", summary: "Thread pools and locks", tags: ["Java", "JVM"], markdown: "# Thread pool", publishedAt: new Date(),
}, {
  id: "ai", slug: "ai-engineering", title: "AI Engineering", summary: "Model integration", tags: ["AI"], markdown: "# Providers", publishedAt: new Date(),
}];

describe("public knowledge discovery", () => {
  it("filters only public article fields by a normalized query", () => {
    expect(filterPublicKnowledgeArticles(articles, { query: "  THREAD  " }).map((article) => article.slug)).toEqual(["java-concurrency"]);
    expect(filterPublicKnowledgeArticles(articles, { query: "ai" }).map((article) => article.slug)).toEqual(["ai-engineering"]);
  });

  it("filters tags without making tag capitalization part of the URL contract", () => {
    expect(filterPublicKnowledgeArticles(articles, { tag: "java" }).map((article) => article.slug)).toEqual(["java-concurrency"]);
    expect(filterPublicKnowledgeArticles(articles, { tag: "missing" })).toEqual([]);
  });
});
