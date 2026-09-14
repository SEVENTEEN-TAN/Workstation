import type { ReactNode } from "react";

import styles from "../../app/admin/admin.module.css";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow = "PERSONAL WORKSTATION",
  action,
}: PageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <span className={styles.kicker}>{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className={styles.pageHeaderAction}>{action}</div> : null}
    </header>
  );
}
