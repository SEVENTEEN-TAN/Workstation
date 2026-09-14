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
import { PageHeader } from "../src/components/admin/PageHeader";

const projectRoot = resolve(import.meta.dirname, "..");

function readProjectFile(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin navigation contracts", () => {
  it("defines the four route-addressable administration modules", () => {
    expect(ADMIN_NAV_ITEMS.map(({ id, href }) => ({ id, href }))).toEqual([
      { id: "overview", href: "/admin/overview" },
      { id: "home", href: "/admin/home" },
      { id: "okr", href: "/admin/okr" },
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
});

describe("admin route contracts", () => {
  it("redirects the admin index to the overview route", () => {
    const source = readProjectFile("src/app/admin/page.tsx");

    expect(source).toContain('redirect("/admin/overview")');
    expect(source).not.toContain("AdminWorkspace");
  });

  it.each(["overview", "home", "okr", "media"])(
    "provides a server page for the %s module",
    (moduleName) => {
      const source = readProjectFile(`src/app/admin/(workspace)/${moduleName}/page.tsx`);

      expect(source).toMatch(/export default async function/);
    },
  );
});
