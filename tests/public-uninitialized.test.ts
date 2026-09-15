import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteUninitialized } from "../src/components/public/SiteUninitialized";

describe("site uninitialized state", () => {
  it("renders one restrained bilingual public state without recovery details", () => {
    const html = renderToStaticMarkup(createElement(SiteUninitialized));

    expect(html).toContain("内容尚未发布");
    expect(html).toContain("Content is not published yet");
    expect(html).not.toContain("/admin");
    expect(html).not.toContain("seed");
    expect(html).not.toContain("database");
  });
});
