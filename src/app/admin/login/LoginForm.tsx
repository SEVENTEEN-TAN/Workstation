"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

import styles from "../admin.module.css";

interface LoginFormProps {
  nextPath: string;
}

export function getLoginErrorMessage(status: number) {
  return status === 429 ? "尝试次数过多，请稍后再试。" : "用户名或密码错误。";
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: data.get("username"),
          password: data.get("password"),
        }),
      });

      if (!response.ok) {
        setError(getLoginErrorMessage(response.status));
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("登录请求失败，请检查网络后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-busy={busy}>
      <label>
        <span>用户名</span>
        <input
          name="username"
          autoComplete="username"
          placeholder="请输入管理员用户名"
          disabled={busy}
          autoFocus
          required
        />
      </label>
      <div className={styles.formField}>
        <label htmlFor="admin-password">密码</label>
        <span className={styles.passwordField}>
          <input
            id="admin-password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="请输入管理员密码"
            disabled={busy}
            required
          />
          <button
            type="button"
            className={styles.passwordToggle}
            title={passwordVisible ? "隐藏密码" : "显示密码"}
            aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
            aria-pressed={passwordVisible}
            disabled={busy}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </span>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button
        type="submit"
        className={`${styles.primaryButton} ${styles.authSubmit}`}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? <LoaderCircle className={styles.spin} size={17} aria-hidden="true" /> : <LogIn size={17} aria-hidden="true" />}
        <span>{busy ? "登录中" : "登录"}</span>
      </button>
    </form>
  );
}
