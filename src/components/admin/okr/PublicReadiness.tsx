import styles from "../../../app/admin/admin.module.css";

export function PublicReadiness({ issues }: { issues: string[] }) {
  return <span className={styles.publicReadiness}>
    <strong>{issues.length ? "暂不在前台展示" : "满足前台展示条件"}</strong>
    {issues.map((issue, index) => <span key={`${index}:${issue}`}>{issue}</span>)}
  </span>;
}
