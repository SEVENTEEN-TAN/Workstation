"use client";

import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

import styles from "../admin.module.css";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: data.get("username"), password: data.get("password") }) });
    setBusy(false);
    if (response.ok) router.push("/admin"); else setError(response.status === 429 ? "尝试次数过多，请稍后再试。" : "用户名或密码错误。");
  }
  return <form className={styles.form} onSubmit={submit}><label>用户名<input name="username" autoComplete="username" required /></label><label>密码<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.primaryButton} disabled={busy}><LogIn size={17} />{busy ? "登录中" : "登录"}</button></form>;
}
