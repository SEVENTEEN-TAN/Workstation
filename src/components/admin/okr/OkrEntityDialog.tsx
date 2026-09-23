"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import styles from "../../../app/admin/admin.module.css";

interface OkrEntityDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}

export function OkrEntityDialog({ open, title, description, children, onClose }: OkrEntityDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previousOverflow; };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.entityDialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className={styles.entityDialogHeader}>
        <div>
          <span className={styles.kicker}>STRUCTURED EDITOR</span>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <button type="button" className={styles.iconButton} aria-label="关闭" title="关闭" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className={styles.entityDialogBody}>{open ? children : null}</div>
    </dialog>
  );
}
