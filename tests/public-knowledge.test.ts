import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

let KnowledgeMarkdown: ComponentType<{ content: string }> | null = null;
try {
  ({ KnowledgeMarkdown } = await import("../src/components/knowledge/KnowledgeMarkdown"));
} catch {
  // The first red run intentionally verifies that the public renderer is absent.
}

describe("public knowledge articles", () => {
  it("renders public Markdown without executing raw HTML", () => {
    expect(KnowledgeMarkdown).not.toBeNull();
    expect(renderToStaticMarkup(createElement(KnowledgeMarkdown!, { content: "<script>x</script>" })))
      .toContain("&lt;script&gt;x&lt;/script&gt;");
  });

  it("uses article-only public routes", () => {
    const listRoute = readProjectFile("src/app/knowledge/page.tsx");
    const articleRoute = readProjectFile("src/app/knowledge/[slug]/page.tsx");

    expect(`${listRoute}\n${articleRoute}`).toContain("knowledgeArticleService");
    expect(articleRoute).toContain("getPublicArticle");
    expect(`${listRoute}\n${articleRoute}`).not.toContain("knowledgeVaultService");
    expect(`${listRoute}\n${articleRoute}`).not.toContain("KnowledgePublicationDraft");
  });

  it("uses collection-only public routes without private knowledge services", () => {
    const listRoute = readProjectFile("src/app/knowledge/collections/page.tsx");
    const collectionRoute = readProjectFile("src/app/knowledge/collections/[slug]/page.tsx");

    expect(listRoute).toContain("knowledgeCollectionService.listPublic");
    expect(collectionRoute).toContain("knowledgeCollectionService.getPublic");
    expect(`${listRoute}\n${collectionRoute}`).not.toContain("knowledgeVaultService");
    expect(`${listRoute}\n${collectionRoute}`).not.toContain("KnowledgePublicationDraft");
  });
});
