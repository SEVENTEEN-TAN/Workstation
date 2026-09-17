import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_NAV_ITEMS,
  resolveAdminNavItem,
  sanitizeAdminReturnPath,
} from "../src/components/admin/navigation";
import { AdminRequestError, adminRequest } from "../src/components/admin/request";
import { createFeedback } from "../src/components/admin/useAdminAction";
import { EmptyState } from "../src/components/admin/EmptyState";
import { ObsidianMarkdownPreview } from "../src/components/admin/ObsidianMarkdownPreview";
import { PageHeader } from "../src/components/admin/PageHeader";
import { OkrEntityDialog } from "../src/components/admin/okr/OkrEntityDialog";
import type { AssetData } from "../src/components/admin/types";

const projectRoot = resolve(import.meta.dirname, "..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

function readOptionalProjectFile(path: string) {
  try {
    return readProjectFile(path);
  } catch {
    return "";
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin navigation contracts", () => {
  it("defines the route-addressable administration modules", () => {
    expect(ADMIN_NAV_ITEMS.map(({ id, href }) => ({ id, href }))).toEqual([
      { id: "overview", href: "/admin/overview" },
      { id: "home", href: "/admin/home" },
      { id: "okr", href: "/admin/okr" },
      { id: "activities", href: "/admin/activities" },
      { id: "projects", href: "/admin/projects" },
      { id: "experience", href: "/admin/experience" },
      { id: "skills", href: "/admin/skills" },
      { id: "resume", href: "/admin/resume" },
      { id: "knowledge", href: "/admin/knowledge" },
      { id: "media", href: "/admin/media" },
    ]);
  });

  it("resolves first-level and nested routes without matching unknown siblings", () => {
    expect(resolveAdminNavItem("/admin/okr")?.id).toBe("okr");
    expect(resolveAdminNavItem("/admin/okr/cycles/c1")?.id).toBe("okr");
    expect(resolveAdminNavItem("/admin/okr-archive")).toBeUndefined();
    expect(resolveAdminNavItem("/admin/unknown")).toBeUndefined();
  });
});

describe("admin return-path contracts", () => {
  it("preserves a local admin path and its query string", () => {
    expect(sanitizeAdminReturnPath("/admin/media?filter=png")).toBe("/admin/media?filter=png");
  });

  it.each([
    "/admin/login",
    "/admin/setup",
    "/admin/login/reset",
    "https://example.com/admin/okr",
    "//example.com/admin/okr",
    "/admin/%2e%2e/login",
    "/public",
    null,
  ])("falls back for an unsafe return path: %s", (value) => {
    expect(sanitizeAdminReturnPath(value)).toBe("/admin/overview");
  });
});

describe("administrator entry contracts", () => {
  it("keeps throttling distinct while hiding every credential failure detail", async () => {
    const loginModule = await import("../src/app/admin/login/LoginForm");
    expect("getLoginErrorMessage" in loginModule).toBe(true);

    const getLoginErrorMessage = Reflect.get(loginModule, "getLoginErrorMessage") as
      | ((status: number) => string)
      | undefined;

    expect(getLoginErrorMessage?.(429)).toBe("尝试次数过多，请稍后再试。");
    expect(getLoginErrorMessage?.(401)).toBe("用户名或密码错误。");
    expect(getLoginErrorMessage?.(500)).toBe("用户名或密码错误。");
  });

  it("passes only the sanitized return path into the login form", () => {
    const source = readProjectFile("src/app/admin/login/page.tsx");

    expect(source).toContain("sanitizeAdminReturnPath");
    expect(source).toMatch(/<LoginForm\s+nextPath=\{[^}]+\}/);
  });

  it("preserves the requested admin query string through the login redirect", () => {
    const source = readProjectFile("src/proxy.ts");

    expect(source).toMatch(/request\.nextUrl\.pathname\s*\+\s*request\.nextUrl\.search/);
  });
});

describe("admin feedback contracts", () => {
  it("announces success non-urgently", () => {
    expect(createFeedback("success", "草稿已保存")).toEqual({
      kind: "success",
      message: "草稿已保存",
      role: "status",
    });
  });

  it("announces failures as alerts", () => {
    expect(createFeedback("error", "请求失败")).toEqual({
      kind: "error",
      message: "请求失败",
      role: "alert",
    });
  });
});

describe("admin request contracts", () => {
  it("returns a successful JSON response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ saved: true })));

    await expect(adminRequest<{ saved: boolean }>("/api/admin/site/draft")).resolves.toEqual({ saved: true });
  });

  it("exposes validation issue paths on typed request errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      error: "VALIDATION_ERROR",
      issues: [{ path: ["content", "hero", "title"], message: "标题不能为空", code: "too_small" }],
    }, { status: 400 })));

    const error = await adminRequest("/api/admin/site/draft").catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(AdminRequestError);
    expect(error).toMatchObject({
      status: 400,
      message: "标题不能为空",
      issues: [{ path: ["content", "hero", "title"], message: "标题不能为空" }],
    });
  });

  it("redirects browser-side 401 responses with the current safe admin path", async () => {
    let redirectedTo = "";
    vi.stubGlobal("window", {
      location: {
        pathname: "/admin/okr",
        search: "?cycle=q4",
        replace(value: string) {
          redirectedTo = value;
        },
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "登录已失效" }, { status: 401 })));

    await expect(adminRequest("/api/admin/okr")).rejects.toMatchObject({ status: 401 });
    expect(redirectedTo).toBe("/admin/login?next=%2Fadmin%2Fokr%3Fcycle%3Dq4");
  });
});

describe("admin shell markup contracts", () => {
  it("renders Obsidian reading syntax without executing raw HTML or Dataview", () => {
    const markup = renderToStaticMarkup(
      createElement(ObsidianMarkdownPreview, {
        content: [
          "> [!note] Reading note",
          "> Keep this private.",
          "",
          "| Name | Value |",
          "| --- | --- |",
          "| Status | Active |",
          "",
          "- [x] Reviewed",
          "",
          "```dataview",
          "list from #private",
          "```",
          "",
          "<script>window.__unsafe = true</script>",
        ].join("\n"),
      }),
    );

    expect(markup).toContain("Reading note");
    expect(markup).toContain("Keep this private.");
    expect(markup).toContain("<table>");
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain("Dataview 查询（未执行）");
    expect(markup).toContain("&lt;script&gt;window.__unsafe = true&lt;/script&gt;");
    expect(markup).not.toContain("<script>window.__unsafe");
  });

  it("renders a page title and optional description", () => {
    const markup = renderToStaticMarkup(
      createElement(PageHeader, {
        title: "OKR 管理",
        description: "聚焦目标、关键结果与复盘。",
      }),
    );

    expect(markup).toContain("OKR 管理");
    expect(markup).toContain("聚焦目标、关键结果与复盘。");
  });

  it("renders exactly one relevant empty-state action", () => {
    const markup = renderToStaticMarkup(
      createElement(EmptyState, {
        title: "还没有媒体资源",
        description: "上传第一张图片后，可在主页内容中引用。",
        action: createElement("button", { type: "button" }, "上传图片"),
      }),
    );

    expect(markup).toContain("还没有媒体资源");
    expect(markup).toContain("上传图片");
    expect(markup.match(/<button/g)).toHaveLength(1);
  });

  it("unmounts closed OKR editor fields so reopened forms receive fresh defaults", () => {
    const closedMarkup = renderToStaticMarkup(
      createElement(OkrEntityDialog, {
        open: false,
        title: "编辑周期",
        onClose() {},
      }, createElement("input", { name: "status", defaultValue: "ACTIVE" })),
    );
    const openMarkup = renderToStaticMarkup(
      createElement(OkrEntityDialog, {
        open: true,
        title: "编辑周期",
        onClose() {},
      }, createElement("input", { name: "status", defaultValue: "ACTIVE" })),
    );

    expect(closedMarkup).not.toContain('name="status"');
    expect(openMarkup).toContain('value="ACTIVE"');
  });
});

describe("admin route contracts", () => {
  it("redirects the admin index to the overview route", () => {
    const source = readProjectFile("src/app/admin/page.tsx");

    expect(source).toContain('redirect("/admin/overview")');
    expect(source).not.toContain("AdminWorkspace");
  });

  it.each(["overview", "home", "okr", "activities", "projects", "experience", "skills", "resume", "knowledge", "media"])(
    "provides a server page for the %s module",
    (moduleName) => {
      const source = readProjectFile(`src/app/admin/(workspace)/${moduleName}/page.tsx`);

      expect(source).toMatch(/export default async function/);
    },
  );

  it("provides route-addressable OKR cycle and Objective pages", () => {
    expect(readProjectFile("src/app/admin/(workspace)/okr/cycles/[cycleId]/page.tsx"))
      .toContain("OkrCycleWorkspace");
    expect(readProjectFile("src/app/admin/(workspace)/okr/cycles/[cycleId]/objectives/[objectiveId]/page.tsx"))
      .toContain("ObjectiveWorkspace");
  });

  it("protects activity APIs and provides the complete activity form", () => {
    const collectionRoute = readProjectFile("src/app/api/admin/activities/route.ts");
    const itemRoute = readProjectFile("src/app/api/admin/activities/[id]/route.ts");
    const workspace = readProjectFile("src/components/admin/CareerActivitiesWorkspace.tsx");

    expect(collectionRoute).toContain("withAdminSession");
    expect(itemRoute).toContain("withAdminSession");
    for (const field of ["titleZh", "titleEn", "summaryZh", "summaryEn", "occurredAt", "visibility", "featured", "linkUrl"]) {
      expect(workspace).toContain(`name=\"${field}\"`);
    }
    expect(workspace).toContain("ConfirmDialog");
    expect(workspace).toContain("FeedbackCenter");
  });

  it("protects project APIs and provides the complete project evidence form", () => {
    const collectionRoute = readProjectFile("src/app/api/admin/projects/route.ts");
    const itemRoute = readProjectFile("src/app/api/admin/projects/[id]/route.ts");
    const workspace = readProjectFile("src/components/admin/PortfolioProjectsWorkspace.tsx");

    expect(collectionRoute).toContain("withAdminSession");
    expect(itemRoute).toContain("withAdminSession");
    for (const field of [
      "slug",
      "titleZh",
      "titleEn",
      "summaryZh",
      "summaryEn",
      "contextZh",
      "contextEn",
      "responsibilityZh",
      "responsibilityEn",
      "challengeZh",
      "challengeEn",
      "approachZh",
      "approachEn",
      "resultZh",
      "resultEn",
      "coverAltZh",
      "coverAltEn",
      "technologies",
      "visibility",
      "featured",
      "sortOrder",
      "startedAt",
      "completedAt",
    ]) {
      expect(workspace).toContain(`name="${field}"`);
    }
    expect(workspace).toContain("AssetPicker");
    expect(workspace).toContain("ConfirmDialog");
    expect(workspace).toContain("FeedbackCenter");
  });

  it("protects experience APIs and provides the complete timeline form", () => {
    const collectionRoute = readProjectFile("src/app/api/admin/experience/route.ts");
    const itemRoute = readProjectFile("src/app/api/admin/experience/[id]/route.ts");
    const workspace = readProjectFile("src/components/admin/ExperienceRecordsWorkspace.tsx");

    expect(collectionRoute).toContain("withAdminSession");
    expect(itemRoute).toContain("withAdminSession");
    for (const field of [
      "kind",
      "organizationZh",
      "organizationEn",
      "titleZh",
      "titleEn",
      "descriptionZh",
      "descriptionEn",
      "locationZh",
      "locationEn",
      "linkUrl",
      "startedAt",
      "endedAt",
      "isCurrent",
      "visibility",
      "featured",
      "sortOrder",
    ]) {
      expect(workspace).toContain(`name="${field}"`);
    }
    expect(workspace).toContain("ConfirmDialog");
    expect(workspace).toContain("FeedbackCenter");
  });

  it("protects skill APIs and provides the capability evidence form", () => {
    const collectionRoute = readProjectFile("src/app/api/admin/skills/route.ts");
    const itemRoute = readProjectFile("src/app/api/admin/skills/[id]/route.ts");
    const workspace = readProjectFile("src/components/admin/SkillAreasWorkspace.tsx");

    expect(collectionRoute).toContain("withAdminSession");
    expect(itemRoute).toContain("withAdminSession");
    for (const field of [
      "nameZh",
      "nameEn",
      "descriptionZh",
      "descriptionEn",
      "visibility",
      "sortOrder",
    ]) {
      expect(workspace).toContain(`name="${field}"`);
    }
    expect(workspace).toContain("ConfirmDialog");
    expect(workspace).toContain("FeedbackCenter");
    expect(workspace).toContain('projects.length ? "PROJECT" : "ARTICLE"');
    expect(workspace).toContain("暂无项目，可先使用文章证据");
  });

  it("provides fixed Chinese and English PDF resume slots with shared feedback patterns", () => {
    const page = readProjectFile("src/app/admin/(workspace)/resume/page.tsx");
    const workspace = readProjectFile("src/components/admin/ResumeFilesWorkspace.tsx");

    expect(page).toContain("ResumeFilesWorkspace");
    expect(page).toContain("getResumeFileService");
    expect(workspace).toContain('accept=".pdf,application/pdf"');
    expect(workspace).toContain('locale: "ZH"');
    expect(workspace).toContain('locale: "EN"');
    expect(workspace).toContain("ConfirmDialog");
    expect(workspace).toContain("FeedbackCenter");
    expect(workspace).toContain("/api/admin/resume");
  });

  it("protects vault APIs and provides registration, scan, search, and removal flows", () => {
    const collectionRoute = readProjectFile("src/app/api/admin/knowledge/vaults/route.ts");
    const itemRoute = readProjectFile("src/app/api/admin/knowledge/vaults/[id]/route.ts");
    const scanRoute = readProjectFile("src/app/api/admin/knowledge/vaults/[id]/scan/route.ts");
    const noteRoute = readProjectFile("src/app/api/admin/knowledge/vaults/[id]/notes/route.ts");
    const page = readProjectFile("src/app/admin/(workspace)/knowledge/page.tsx");
    const workspace = readProjectFile("src/components/admin/KnowledgeWorkspace.tsx");
    const adminStyles = readProjectFile("src/app/admin/admin.module.css");

    expect(collectionRoute).toContain("withAdminSession");
    expect(itemRoute).toContain("withAdminSession");
    expect(scanRoute).toContain("withAdminSession");
    expect(noteRoute).toContain("withAdminSession");
    expect(noteRoute).toContain("readNote");
    expect(page).toContain("KnowledgeWorkspace");
    for (const field of ["name", "rootPath", "ignorePatterns"]) {
      expect(workspace).toContain(`name="${field}"`);
    }
    expect(workspace).toContain("扫描知识库");
    expect(workspace).toContain("搜索相对路径");
    expect(workspace).toContain("尚未扫描知识库");
    expect(workspace).toContain("最新同步报告");
    expect(workspace).toContain("疑似缺失");
    expect(workspace).toContain("未解析链接");
    expect(workspace).toContain("正向链接");
    expect(workspace).toContain("查看笔记");
    expect(workspace).toContain("/notes?path=");
    expect(workspace).toContain("知识库目录");
    expect(workspace).toContain("笔记属性");
    expect(workspace).toContain("反向链接");
    expect(workspace).toContain("buildKnowledgeNoteTree");
    expect(adminStyles).toMatch(/@media \(max-width: 899px\)[\s\S]*\.knowledgeIndexLayout\s*\{\s*grid-template-columns:\s*1fr/);
    expect(adminStyles).toMatch(/@media \(max-width: 639px\)[\s\S]*\.noteInspector\s*\{\s*grid-template-columns:\s*1fr/);
    expect(workspace).not.toContain("dangerouslySetInnerHTML");
    expect(workspace).toContain("syncReports");
    expect(workspace).toContain("syncReport");
    expect(workspace).toContain("ConfirmDialog");
    expect(workspace).toContain("FeedbackCenter");
  });

  it("links the homepage skill summary to the structured capability page", () => {
    const about = readProjectFile("src/components/public/About.tsx");

    expect(about).toContain('href="/skills"');
  });
});

describe("homepage version safety contracts", () => {
  const workspaceSource = readProjectFile("src/components/admin/HomeWorkspace.tsx");
  const editorSource = readOptionalProjectFile("src/components/admin/home/HomepageEditor.tsx");
  const adminStyles = readProjectFile("src/app/admin/admin.module.css");
  const homepageCmsSource = `${workspaceSource}\n${editorSource}`;

  it("organizes homepage editing around four resume tasks with paired bilingual fields", () => {
    for (const section of ["meta", "nav", "hero", "about", "works", "services", "footer", "projects"]) {
      expect(homepageCmsSource).toContain(`id: "${section}"`);
    }

    for (const group of ["个人与首屏", "能力展示", "项目展示", "联系与导航"]) {
      expect(editorSource).toContain(group);
    }
    expect(editorSource).toContain("中文内容");
    expect(editorSource).toContain("English content");
    expect(editorSource).not.toContain("编辑语言");
  });

  it("keeps rare copy collapsed and separates editing from publication history", () => {
    expect(editorSource).toContain("高级文案");
    expect(editorSource).toContain("<details");
    expect(workspaceSource).toContain("编辑内容");
    expect(workspaceSource).toContain("发布记录");
    expect(workspaceSource).toContain("homeActionBar");
  });

  it("keeps all four homepage task tabs visible on narrow screens", () => {
    expect(adminStyles).toMatch(
      /@media \(max-width: 639px\)[\s\S]*\.sectionRail\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/,
    );
  });

  it("replaces JSON editing and placeholder copy with publish readiness", () => {
    expect(homepageCmsSource).not.toContain("完整双语内容 JSON");
    expect(homepageCmsSource).not.toContain("结构化表单将在下一轮接入");
    expect(homepageCmsSource).toContain("发布就绪");
  });

  it("protects dirty homepage edits before browser navigation", () => {
    expect(homepageCmsSource).toContain("beforeunload");
  });

  it("uses draft-only restore language throughout the version flow", () => {
    expect(workspaceSource).toContain("恢复为草稿");
    expect(workspaceSource).not.toMatch(/确认回滚|版本已回滚并发布|>回滚</);
  });

  it("requires the shared confirmation dialog before restoring a historical version", () => {
    const source = workspaceSource;

    expect(source).toContain('import { ConfirmDialog } from "./ConfirmDialog"');
    expect(source).toContain("setRollbackRequest(version)");
    expect(source).toMatch(/<ConfirmDialog[\s\S]*confirmLabel="恢复为草稿"/);
  });
});

describe("OKR execution workspace contracts", () => {
  const listSource = readOptionalProjectFile("src/components/admin/okr/OkrCycleListWorkspace.tsx");
  const cycleSource = readOptionalProjectFile("src/components/admin/okr/OkrCycleWorkspace.tsx");
  const objectiveSource = readOptionalProjectFile("src/components/admin/okr/ObjectiveWorkspace.tsx");
  const dialogSource = readOptionalProjectFile("src/components/admin/okr/OkrEntityDialog.tsx");
  const checkInSource = readOptionalProjectFile("src/components/admin/okr/KrCheckInPanel.tsx");
  const actionSource = readOptionalProjectFile("src/components/admin/okr/ActionItemList.tsx");
  const allSources = [listSource, cycleSource, objectiveSource, dialogSource, checkInSource, actionSource].join("\n");

  it("replaces JSON prompt editing with structured dialogs", () => {
    expect(allSources).toContain("OkrEntityDialog");
    expect(allSources).not.toContain("window.prompt");
    expect(allSources).not.toContain("编辑字段 JSON");
  });

  it("exposes KR check-ins, history, risk signals, and action items", () => {
    expect(checkInSource).toContain("进度历史");
    expect(checkInSource).toContain("记录进度");
    expect(objectiveSource).toContain("已逾期");
    expect(objectiveSource).toContain("长期未更新");
    expect(actionSource).toContain("行动项");
    expect(actionSource).toContain("建议记录一次 KR 进度");
  });

  it("guides completed cycles into a cycle review", () => {
    expect(cycleSource).toContain("创建周期复盘");
    expect(cycleSource).toContain('cycle.status === "COMPLETED"');
  });

  it("shows weekday choices only for weekly recurring actions", () => {
    expect(actionSource).toContain('recurrenceType === "WEEKLY" ? <fieldset');
  });

  it("routes KR status changes through the shared action feedback", () => {
    expect(objectiveSource).toContain('runAction(`kr:status:${keyResult.id}`');
    expect(objectiveSource).not.toContain('.then(() => router.refresh())');
  });

  it("loads structured projects and edits homepage selection instead of embedded cards", () => {
    const pageSource = readProjectFile("src/app/admin/(workspace)/home/page.tsx");
    const workspaceSource = readProjectFile("src/components/admin/HomeWorkspace.tsx");
    const editorSource = readProjectFile("src/components/admin/home/HomepageEditor.tsx");

    expect(pageSource).toContain("asset.findMany");
    expect(pageSource).toContain("portfolioProjectService.list()");
    expect(pageSource).toContain("initialProjects");
    expect(workspaceSource).toContain("initialProjects");
    expect(workspaceSource).toContain("projects={projects}");
    expect(editorSource).toContain("selectedProjectIds");
    expect(editorSource).toContain("旧版项目快照");
    expect(editorSource).toContain("迁移为结构化项目");
    expect(editorSource).toContain('href="/admin/projects"');
    expect(editorSource).toContain("移除项目");
    expect(editorSource).toContain("上移项目");
    expect(editorSource).toContain("下移项目");
    expect(editorSource).toContain("私密");
    expect(editorSource).toContain("信息待完善");
    expect(editorSource).toContain("公开可展示");
    expect(editorSource).not.toContain('pairedField(["projects", projectIndex, "title"]');
    expect(editorSource).not.toContain("AssetPicker");
    expect(editorSource).not.toContain("图片路径或 URL");
    expect(editorSource).not.toContain("选择媒体");
  });

  it("renders the public homepage only from its saved site snapshot", () => {
    const homeRouteSource = readProjectFile("src/app/page.tsx");
    const homeExperienceSource = readProjectFile("src/components/public/HomeExperience.tsx");
    const recentWorksSource = readProjectFile("src/components/public/RecentWorks.tsx");

    expect(homeRouteSource).not.toContain("portfolioProjectService");
    expect(homeRouteSource).not.toContain("toPublicPortfolioProject");
    expect(homeExperienceSource).not.toContain("projects");
    expect(recentWorksSource).not.toContain("structuredProjects");
    expect(recentWorksSource).toContain("toRecentProjectViews(locale, copy.projects)");
  });
});

describe("media-library contracts", () => {
  const mediaSource = readProjectFile("src/components/admin/MediaWorkspace.tsx");
  const requestSource = readProjectFile("src/components/admin/request.ts");
  const assetRouteSource = readProjectFile("src/app/api/assets/[id]/route.ts");

  it("provides upload progress, combined filters, preview, and alternative-text editing", () => {
    expect(mediaSource).toContain("uploadAdminAsset");
    expect(mediaSource).toContain("<progress");
    expect(mediaSource).toContain("搜索文件名或替代文本");
    expect(mediaSource).toContain("预览图片");
    expect(mediaSource).toContain("保存替代文本");
  });

  it("shows usage locations and protects referenced assets from deletion", () => {
    expect(mediaSource).toContain("使用位置");
    expect(mediaSource).toContain("仍被内容版本引用，无法删除");
    expect(mediaSource).toContain("ConfirmDialog");
    expect(mediaSource).toContain('jsonRequest("DELETE", {})');
  });

  it("replaces a file only after confirmation while preserving its public URL", () => {
    expect(mediaSource).toContain("替换文件");
    expect(mediaSource).toContain("所有使用位置会同步更新");
    expect(mediaSource).toMatch(/<ConfirmDialog[\s\S]*confirmLabel="确认替换"/);
    expect(mediaSource).toContain("selectedAsset.sha256");
    expect(requestSource).toContain('method = "POST"');
    expect(requestSource).toContain('path = "/api/admin/assets"');
    expect(requestSource).toContain("request.open(method, path)");
    expect(mediaSource).toContain("if (!updated) { setReplaceRequest(null); return; }");
  });

  it("revalidates stable public asset URLs with their content hash", () => {
    expect(assetRouteSource).toContain('request.headers.get("if-none-match")');
    expect(assetRouteSource).toContain("status: 304");
    expect(assetRouteSource).toContain('"etag"');
    expect(assetRouteSource).toContain('"public, max-age=0, must-revalidate"');
    expect(assetRouteSource).not.toContain("immutable");
  });

  it("combines filename, type, and alternative-text filters", async () => {
    const { filterAssets } = await import("../src/components/admin/MediaWorkspace");
    const assets = [
      {
        id: "png-complete",
        originalFilename: "dashboard.png",
        mimeType: "image/png",
        width: 100,
        height: 100,
        sizeBytes: 10,
        sha256: "a",
        altTextZh: "项目看板",
        altTextEn: "Project dashboard",
        isReferenced: false,
        references: [],
        createdAt: "2026-09-15T00:00:00.000Z",
      },
      {
        id: "jpg-missing",
        originalFilename: "portrait.jpg",
        mimeType: "image/jpeg",
        width: 100,
        height: 100,
        sizeBytes: 10,
        sha256: "b",
        altTextZh: null,
        altTextEn: null,
        isReferenced: false,
        references: [],
        createdAt: "2026-09-15T00:00:00.000Z",
      },
    ] satisfies AssetData[];

    expect(filterAssets(assets, { query: "看板", mimeType: "image/png", altState: "complete" }))
      .toEqual([assets[0]]);
    expect(filterAssets(assets, { query: "", mimeType: "", altState: "missing" }))
      .toEqual([assets[1]]);
  });
});
