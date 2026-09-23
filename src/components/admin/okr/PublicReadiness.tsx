import styles from "../../../app/admin/admin.module.css";

export function PublicReadiness({ issues, notes = [], destination, nextStep }: { issues: string[]; notes?: string[]; destination: string; nextStep: string }) {
  return <span className={styles.publicReadiness}>
    <strong>{issues.length ? "暂不在前台展示" : "满足前台展示条件"}</strong>
    {issues.map((issue, index) => <span key={`${index}:${issue}`}>{issue}</span>)}
    {notes.map((note, index) => <span key={`note:${index}:${note}`}>部分内容未展示：{note}</span>)}
    <span>展示去向：{destination}</span>
    <span>生效步骤：{nextStep}</span>
  </span>;
}
