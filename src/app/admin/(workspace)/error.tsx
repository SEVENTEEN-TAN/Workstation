"use client";

import { RotateCcw } from "lucide-react";

import styles from "../admin.module.css";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className={styles.statePage} role="alert">
      <span className={styles.errorMark}>!</span>
      <div>
        <h1>工作区载入失败</h1>
        <p>数据暂时没有准备好，请重新尝试。</p>
      </div>
      <button type="button" className={styles.primaryButton} onClick={reset}>
        <RotateCcw size={17} />重新加载
      </button>
    </section>
  );
}
