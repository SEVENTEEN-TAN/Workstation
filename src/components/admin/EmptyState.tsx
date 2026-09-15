import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

import styles from "../../app/admin/admin.module.css";

interface EmptyStateProps {
  title: string;
  description: string;
  action: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden="true"><Inbox size={20} /></span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className={styles.emptyAction}>{action}</div>
    </div>
  );
}
