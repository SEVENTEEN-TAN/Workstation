import { describe, expect, it } from "vitest";

import { validateArticleEmbedMappings, rewriteArticleEmbeds } from "../src/lib/knowledge/article-attachments";

describe("article attachment snapshots", () => {
  it("rewrites only explicitly mapped image embeds to article-owned URLs", () => {
    expect(rewriteArticleEmbeds("![[diagram.png]]", [{ target: "diagram.png", id: "snapshot-1" }]))
      .toBe("![](/api/knowledge/assets/snapshot-1)");
  });

  it("rejects publication when an image embed is unselected or mapped twice", () => {
    expect(() => validateArticleEmbedMappings(["diagram.png"], [])).toThrow("Article attachment mappings are incomplete");
    expect(() => validateArticleEmbedMappings(["diagram.png"], [
      { target: "diagram.png", id: "snapshot-1" },
      { target: "diagram.png", id: "snapshot-2" },
    ])).toThrow("Article attachment mappings are incomplete");
  });
});
