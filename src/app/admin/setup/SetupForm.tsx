"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, UserRoundCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import styles from "../admin.module.css";

const passwordMinimumLength = process.env.NODE_ENV === "production" ? 12 : 5;
const passwordRequirement = process.env.NODE_ENV === "production"
  ? "生产环境密码至少需要 12 位。"
  : "本地开发可使用 admin / admin；其他密码至少需要 12 位。";

export function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (password !== data.get("confirmPassword")) {
      setBusy(false);
      setError("两次输入的密码不一致。");
      return;
    }
    try {
      const response = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: data.get("username"), password }),
      });
      if (response.ok) {
        router.replace("/admin/login");
        router.refresh();
        return;
      }
      const result = await response.json().catch(() => ({}));
      setError(result.error ?? "初始化失败。");
    } catch {
      setError("初始化请求失败，请检查网络后重试。");
    } finally {
      setBusy(false);
    }
  }

  function passwordControl(
    name: "password" | "confirmPassword",
    label: string,
    visible: boolean,
    setVisible: (visible: boolean) => void,
  ) {
    const inputId = `setup-${name}`;

    return (
      <div className={styles.formField}>
        <label htmlFor={inputId}>{label}</label>
        <span className={styles.passwordField}>
          <input
            id={inputId}
            name={name}
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            minLength={passwordMinimumLength}
            aria-describedby="password-requirement"
            disabled={busy}
            required
          />
          <button
            type="button"
            className={styles.passwordToggle}
            title={visible ? `隐藏${label}` : `显示${label}`}
            aria-label={visible ? `隐藏${label}` : `显示${label}`}
            aria-pressed={visible}
            disabled={busy}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </span>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-busy={busy}>
      <label>
        <span>管理员用户名</span>
        <input
          name="username"
          autoComplete="username"
          minLength={3}
          placeholder="至少 3 个字符"
          disabled={busy}
          autoFocus
          required
        />
      </label>
      {passwordControl("password", "密码", passwordVisible, setPasswordVisible)}
      {passwordControl("confirmPassword", "确认密码", confirmationVisible, setConfirmationVisible)}
      <p id="password-requirement" className={styles.fieldHint}>{passwordRequirement}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button
        type="submit"
        className={`${styles.primaryButton} ${styles.authSubmit}`}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? <LoaderCircle className={styles.spin} size={17} aria-hidden="true" /> : <UserRoundCheck size={17} aria-hidden="true" />}
        <span>{busy ? "正在初始化" : "创建管理员"}</span>
      </button>
    </form>
  );
}
