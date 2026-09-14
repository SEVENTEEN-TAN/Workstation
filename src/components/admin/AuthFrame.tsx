import type { ReactNode } from "react";

import styles from "../../app/admin/admin.module.css";

interface AuthFrameProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthFrame({ eyebrow, title, description, children }: AuthFrameProps) {
  return (
    <main className={styles.loginPage}>
      <div className={styles.authFrame}>
        <section className={styles.authIdentity} aria-labelledby="workstation-identity">
          <div className={styles.authBrandLine}>
            <span className={styles.brandMark} aria-hidden="true">17</span>
            <strong>SEVENTEEN / PERSONAL WORKSTATION</strong>
          </div>

          <div className={styles.authIdentityCopy}>
            <span className={styles.kicker}>ADMINISTRATOR ACCESS</span>
            <h1 id="workstation-identity">PRIVATE<br />CONTROL.</h1>
            <p>维护在线履历、主页内容与 OKR 进展的个人工作站。</p>
          </div>

          <div className={styles.authRole}>
            <span>ENGINEERING IDENTITY</span>
            <strong>FULL-STACK JAVA + AI ENGINEER</strong>
          </div>
        </section>

        <section className={styles.authAccess} aria-labelledby="auth-form-title">
          <div className={styles.loginPanel}>
            <span className={styles.kicker}>{eyebrow}</span>
            <h2 id="auth-form-title">{title}</h2>
            <p>{description}</p>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
