"use client";

import { useEffect, useId, useRef, type RefObject } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";

import styles from "../../app/admin/admin.module.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  target: string;
  description: string;
  busy?: boolean;
  confirmLabel?: string;
  triggerRef?: RefObject<HTMLElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  target,
  description,
  busy = false,
  confirmLabel = "确认删除",
  triggerRef,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.confirmDialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      onClose={() => triggerRef?.current?.focus()}
    >
      <div className={styles.confirmIcon} aria-hidden="true"><AlertTriangle size={22} /></div>
      <div className={styles.confirmCopy}>
        <h2 id={titleId}>{title}</h2>
        <strong>{target}</strong>
        <p id={descriptionId}>{description}</p>
      </div>
      <div className={styles.confirmActions}>
        <button type="button" onClick={onCancel} disabled={busy}>取消</button>
        <button type="button" className={styles.dangerButton} onClick={onConfirm} disabled={busy}>
          {busy ? <LoaderCircle className={styles.spin} size={17} /> : null}
          {busy ? "删除中" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
