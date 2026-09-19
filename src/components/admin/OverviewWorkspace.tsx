"use client";

import Link from "next/link";
import { LoaderCircle, RefreshCw, ScrollText } from "lucide-react";
import { useState } from "react";

import styles from "../../app/admin/admin.module.css";
import { adminRequest } from "./request";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import type { AuditLogData, DashboardData } from "./types";
import { useAdminAction } from "./useAdminAction";

export function OverviewWorkspace({
  initialDashboard,
  initialAuditLogs,
}: {
  initialDashboard: DashboardData;
  initialAuditLogs: AuditLogData[];
}) {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const refreshBusy = isBusy("overview:refresh");

  async function refreshDashboard() {
    await runAction("overview:refresh", async () => {
      const [nextDashboard, nextAuditLogs] = await Promise.all([
        adminRequest<DashboardData>("/api/admin/dashboard"),
        adminRequest<AuditLogData[]>("/api/admin/audit"),
      ]);
      setDashboard(nextDashboard);
      setAuditLogs(nextAuditLogs);
    }, "仪表盘已更新");
  }

  const metrics = [
    ["周期", dashboard.cycleCount],
    ["目标", dashboard.objectiveCount],
    ["平均进度", `${dashboard.averageProgress}%`],
    ["风险目标", dashboard.atRiskObjectives],
  ];

  return (
    <section>
      <PageHeader
        title="仪表盘"
        description="快速掌握目标推进状态和需要关注的风险。"
        action={(
          <button type="button" className={styles.iconTextButton} onClick={refreshDashboard} disabled={refreshBusy}>
            {refreshBusy ? <LoaderCircle className={styles.spin} size={18} /> : <RefreshCw size={18} />}
            {refreshBusy ? "刷新中" : "刷新"}
          </button>
        )}
      />

      <div className={styles.metrics}>
        {metrics.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>PROGRESS</span><h2>目标进度</h2></div>
          <span>{dashboard.completedObjectives} 已完成</span>
        </div>
        {dashboard.objectives.length ? dashboard.objectives.map((item) => (
          <div className={styles.progressRow} key={item.id}>
            <span>{item.titleZh}</span>
            <div aria-label={`${item.titleZh} 进度 ${item.progress}%`}>
              <i style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }} />
            </div>
            <b>{item.progress}%</b>
          </div>
        )) : (
          <EmptyState
            title="还没有目标数据"
            description="创建第一个 OKR 周期和目标后，进度会显示在这里。"
            action={<Link className={styles.secondaryButton} href="/admin/okr">前往 OKR 管理</Link>}
          />
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>AUDIT</span><h2>最近审计日志</h2></div>
          <ScrollText size={18} aria-hidden="true" />
        </div>
        {auditLogs.length ? (
          <div>
            {auditLogs.map((entry) => {
              const succeeded = entry.statusCode < 400;
              return (
                <div className={styles.listRow} key={entry.id}>
                  <strong>{entry.method} {entry.path}</strong>
                  <small>{entry.ipAddress ?? "未知 IP"} · {entry.targetId ?? "无对象"}</small>
                  <span className={succeeded ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>
                    {succeeded ? "成功" : "失败"} {entry.statusCode}
                  </span>
                  <time dateTime={entry.createdAt}>
                    {new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}
                  </time>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="还没有管理操作记录"
            description="执行保存、发布或删除操作后，这里会显示最近结果。"
            action={null}
          />
        )}
        <p className={styles.mutedCopy}>仅记录操作元数据，不保存请求参数、正文或密钥。</p>
      </section>
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
