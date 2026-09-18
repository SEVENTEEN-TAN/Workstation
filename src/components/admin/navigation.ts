import { BarChart3, BookOpen, BriefcaseBusiness, CalendarRange, FileJson, FileText, Flag, Github, GraduationCap, History, ImagePlus, Layers, Newspaper, Target, type LucideIcon } from "lucide-react";

export type AdminNavId = "overview" | "home" | "okr" | "activities" | "weekly" | "milestones" | "timeline" | "projects" | "experience" | "skills" | "resume" | "knowledge" | "github" | "media";

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
  { id: "weekly", href: "/admin/weekly", label: "每周动态", icon: CalendarRange },
  { id: "milestones", href: "/admin/milestones", label: "里程碑草稿", icon: Flag },
  { id: "timeline", href: "/admin/timeline", label: "时间线草稿", icon: History },
  { id: "projects", href: "/admin/projects", label: "项目案例", icon: BriefcaseBusiness },
  { id: "experience", href: "/admin/experience", label: "经历时间线", icon: GraduationCap },
  { id: "skills", href: "/admin/skills", label: "能力矩阵", icon: Layers },
  { id: "resume", href: "/admin/resume", label: "简历管理", icon: FileText },
  { id: "knowledge", href: "/admin/knowledge", label: "知识库", icon: BookOpen },
  { id: "github", href: "/admin/github", label: "GitHub 同步", icon: Github },
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
