"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { LogOut, Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import styles from "../../app/admin/admin.module.css";
import { ADMIN_NAV_ITEMS, resolveAdminNavItem } from "./navigation";
import { adminRequest } from "./request";
import { FeedbackCenter } from "./FeedbackCenter";
import { useAdminAction } from "./useAdminAction";

interface AdminShellProps {
  username: string;
  children: ReactNode;
}

export function AdminShell({ username, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const activeItem = resolveAdminNavItem(pathname);
  const menuOpen = menuPath === pathname;
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const logoutBusy = isBusy("shell:logout");

  async function logout() {
    const result = await runAction(
      "shell:logout",
      () => adminRequest<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    );
    if (result) {
      router.push("/admin/login");
      router.refresh();
    }
  }

  const navigation = (
    <nav className={styles.adminNav} aria-label="后台主导航">
      {ADMIN_NAV_ITEMS.map(({ id, href, label, icon: Icon }) => {
        const active = activeItem?.id === id;
        return (
          <Link
            key={id}
            href={href}
            className={active ? styles.activeNav : undefined}
            aria-current={active ? "page" : undefined}
            onClick={() => setMenuPath(null)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brandBlock}>
          <span className={styles.brandMark}>17</span>
          <div>
            <span className={styles.kicker}>SEVENTEEN</span>
            <strong>WORKSTATION</strong>
          </div>
        </div>
        {navigation}
        <div className={styles.account}>
          <div><span>当前管理员</span><strong>{username}</strong></div>
          <button type="button" title="退出登录" aria-label="退出登录" onClick={logout} disabled={logoutBusy}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <header className={styles.mobileHeader}>
        <Link href="/admin/overview" className={styles.mobileBrand}>
          <span className={styles.brandMark}>17</span>
          <strong>WORKSTATION</strong>
        </Link>
        <button
          type="button"
          className={styles.menuButton}
          aria-label={menuOpen ? "关闭导航菜单" : "打开导航菜单"}
          aria-expanded={menuOpen}
          aria-controls="mobile-admin-navigation"
          onClick={() => setMenuPath(menuOpen ? null : pathname)}
        >
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <div id="mobile-admin-navigation" className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ""}`}>
          {navigation}
          <div className={styles.mobileAccount}>
            <span>{username}</span>
            <button type="button" onClick={logout} disabled={logoutBusy}>
              <LogOut size={17} />退出登录
            </button>
          </div>
        </div>
      </header>

      <main className={styles.workspace}>{children}</main>
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </div>
  );
}
