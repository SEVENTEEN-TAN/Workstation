import { hasAdministrator } from "@/lib/auth/bootstrap";
import { redirect } from "next/navigation";

import styles from "../admin.module.css";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAdministrator()) redirect("/admin/login");
  return <main className={styles.loginPage}><section className={styles.loginPanel}>
    <span className={styles.kicker}>PERSONAL WORKSTATION</span>
    <h1>初始化管理后台</h1>
    <p>创建唯一的管理员账号。完成后该入口会自动关闭。</p>
    <SetupForm />
  </section></main>;
}
