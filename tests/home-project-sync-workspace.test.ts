import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { HomeWorkspace } from "../src/components/admin/HomeWorkspace";
import { bootstrapSiteContent } from "../src/lib/content/bootstrap";
import type { SiteContent } from "../src/lib/content/schema";

function render(content: SiteContent) {
  return renderToStaticMarkup(createElement(HomeWorkspace, {
    initialDraft: { id: "draft", version: 2, status: "DRAFT", content, publishedAt: null },
    initialVersions: [],
    initialProjects: [],
    assets: [],
  }));
}

describe("homepage project synchronization workspace", () => {
  it("offers a deliberate check without marking legacy cards stale", () => {
    const html = render(structuredClone(bootstrapSiteContent));
    expect(html).toContain("检查项目更新");
    expect(html).not.toContain("PROJECT SYNC");
    expect(html).not.toContain("首页项目卡片");
    expect(html.indexOf("检查项目更新")).toBeLessThan(html.indexOf("撤销"));
    expect(html).not.toContain("同步项目更新到工作副本");
    expect(html).not.toContain("项目卡片待同步");
  });

  it("treats an explicit empty selection with no cards as synchronized", () => {
    const content = structuredClone(bootstrapSiteContent);
    content.selectedProjectIds = [];
    content.zh.projects = [];
    content.en.projects = [];
    const html = render(content);
    expect(html).toContain("检查项目更新");
    expect(html).not.toContain("同步项目更新到工作副本");
  });

  it("offers sync when explicit empty selection leaves old cards", () => {
    const content = { ...structuredClone(bootstrapSiteContent), selectedProjectIds: [] };
    const html = render(content);
    expect(html).toContain("检查项目更新");
    expect(html).toContain("项目卡片待同步");
    expect(html).toContain("同步项目更新到工作副本");
    expect(html).toContain("多余的旧卡片");
  });

  it("blocks sync when a selected source project is unavailable", () => {
    const content = { ...structuredClone(bootstrapSiteContent), selectedProjectIds: ["missing"] };
    const html = render(content);
    expect(html).toContain("检查项目更新");
    expect(html).toContain("源项目不可用");
    expect(html).toContain('href="/admin/projects"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*同步项目更新到工作副本/);
  });
});
