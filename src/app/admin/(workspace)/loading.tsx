import styles from "../admin.module.css";

export default function AdminLoading() {
  return (
    <section className={styles.statePage} aria-busy="true" aria-live="polite">
      <span className={styles.loadingMark} aria-hidden="true" />
      <div>
        <h1>正在载入工作区</h1>
        <p>正在同步最新内容与管理数据。</p>
      </div>
      <div className={styles.loadingLines} aria-hidden="true"><i /><i /><i /></div>
    </section>
  );
}
