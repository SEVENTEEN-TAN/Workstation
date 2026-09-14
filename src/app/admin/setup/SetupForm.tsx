"use client";

import { useState, type FormEvent } from "react";
import { UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import styles from "../admin.module.css";

export function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== data.get("confirmPassword")) {
      setBusy(false);
      setError("两次输入的密码不一致。");
      return;
    }
    const response = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: data.get("username"), password }),
    });
    setBusy(false);
    if (response.ok) {
      router.replace("/admin/login");
      router.refresh();
      return;
    }
    const result = await response.json().catch(() => ({}));
    setError(result.error ?? "初始化失败。");
  }

  return <form className={styles.form} onSubmit={submit}>
    <label>管理员用户名<input name="username" autoComplete="username" minLength={3} required /></label>
    <label>密码<input name="password" type="password" autoComplete="new-password" minLength={12} required /></label>
    <label>确认密码<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required /></label>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button className={styles.primaryButton} disabled={busy}><UserRoundCheck size={17} />{busy ? "正在初始化" : "创建管理员"}</button>
  </form>;
}
