import { currentSession } from "@/lib/auth/session";
import { hasAdministrator } from "@/lib/auth/bootstrap";
import { redirect } from "next/navigation";

import { LoginForm } from "./LoginForm";
import styles from "../admin.module.css";

export default async function LoginPage() {
  if (await currentSession()) redirect("/admin");
  if (!(await hasAdministrator())) redirect("/admin/setup");
  return <main className={styles.loginPage}><section className={styles.loginPanel}><span className={styles.kicker}>PERSONAL WORKSTATION</span><h1>管理后台</h1><p>使用管理员账号登录。</p><LoginForm /></section></main>;
}
