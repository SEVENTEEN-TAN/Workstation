"use client";

import { CircleCheck, CircleX, X } from "lucide-react";

import styles from "../../app/admin/admin.module.css";
import type { AdminFeedback } from "./useAdminAction";

interface FeedbackCenterProps {
  feedback: AdminFeedback | null;
  onDismiss: () => void;
}

export function FeedbackCenter({ feedback, onDismiss }: FeedbackCenterProps) {
  if (!feedback) return null;
  const Icon = feedback.kind === "success" ? CircleCheck : CircleX;

  return (
    <div className={styles.feedbackViewport}>
      <div className={`${styles.feedback} ${styles[feedback.kind]}`} role={feedback.role}>
        <Icon size={19} aria-hidden="true" />
        <span>{feedback.message}</span>
        <button type="button" onClick={onDismiss} aria-label="关闭提示">
          <X size={17} />
        </button>
      </div>
    </div>
  );
}
