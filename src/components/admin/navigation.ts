import { BarChart3, BriefcaseBusiness, FileJson, GraduationCap, ImagePlus, Newspaper, Target, type LucideIcon } from "lucide-react";

export type AdminNavId = "overview" | "home" | "okr" | "activities" | "projects" | "experience" | "media";

export interface AdminNavItem {
  id: AdminNavId;
  href: `/admin/${string}`;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { id: "overview", href: "/admin/overview", label: "仪表盘", icon: BarChart3 },
  { id: "home", href: "/admin/home", label: "主页 CMS", icon: FileJson },
  { id: "okr", href: "/admin/okr", label: "OKR 管理", icon: Target },
  { id: "activities", href: "/admin/activities", label: "职业动态", icon: Newspaper },
  { id: "projects", href: "/admin/projects", label: "项目案例", icon: BriefcaseBusiness },
  { id: "experience", href: "/admin/experience", label: "经历时间线", icon: GraduationCap },
  { id: "media", href: "/admin/media", label: "媒体资源", icon: ImagePlus },
];

export const DEFAULT_ADMIN_PATH = "/admin/overview";

export function resolveAdminNavItem(pathname: string): AdminNavItem | undefined {
  const normalizedPath = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "");

  return ADMIN_NAV_ITEMS.find(
    (item) => normalizedPath === item.href || normalizedPath.startsWith(`${item.href}/`),
  );
}

export function sanitizeAdminReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith("/admin/") || value.startsWith("//")) return DEFAULT_ADMIN_PATH;

  try {
    const url = new URL(value, "http://admin.local");
    if (url.origin !== "http://admin.local" || !url.pathname.startsWith("/admin/")) {
      return DEFAULT_ADMIN_PATH;
    }

    if (
      url.pathname === "/admin/login"
      || url.pathname.startsWith("/admin/login/")
      || url.pathname === "/admin/setup"
      || url.pathname.startsWith("/admin/setup/")
    ) {
      return DEFAULT_ADMIN_PATH;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return DEFAULT_ADMIN_PATH;
  }
}
