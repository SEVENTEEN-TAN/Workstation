"use client";

import { Activity, ExternalLink, GitFork, LoaderCircle, RefreshCw, Save, Star } from "lucide-react";
import { useState, type FormEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import { adminRequest } from "./request";
import type { GitHubSyncConfigData, GitHubSyncStateData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "尚未同步";
}

function eventLabel(type: string) {
  return type.endsWith("Event") ? type.slice(0, -5) : type;
}

export function GitHubWorkspace({ initialState }: { initialState: GitHubSyncStateData }) {
  const [state, setState] = useState(initialState);
  const [username, setUsername] = useState(initialState.config?.username ?? "");
  const [enabled, setEnabled] = useState(initialState.config?.enabled ?? true);
  const [selectedRepositories, setSelectedRepositories] = useState<ReadonlySet<string>>(
    () => new Set(initialState.config?.selectedRepositories ?? []),
  );
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const saving = isBusy("github:save");
  const syncing = isBusy("github:sync");

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const config = await runAction("github:save", () => adminRequest<GitHubSyncConfigData>(
      "/api/admin/github",
      jsonRequest("PUT", { username, enabled, selectedRepositories: [...selectedRepositories] }),
    ), "GitHub 同步配置已保存");
    if (!config) return;
    setState((current) => ({
      ...current,
      config,
      repositories: current.repositories.map((repository) => ({
        ...repository,
        selected: selectedRepositories.has(repository.fullName),
      })),
    }));
  }

  async function synchronize() {
    const nextState = await runAction("github:sync", () => adminRequest<GitHubSyncStateData>(
      "/api/admin/github/sync",
      { method: "POST" },
    ), "GitHub 数据已同步");
    if (!nextState) return;
    setState(nextState);
    setSelectedRepositories(new Set(nextState.config?.selectedRepositories ?? []));
  }

  function toggleRepository(fullName: string) {
    setSelectedRepositories((current) => {
      const next = new Set(current);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }

  const selectedCount = selectedRepositories.size;
  const visibleEvents = state.events.slice(0, 20);

  return (
    <section>
      <PageHeader
        title="GitHub 同步"
        description="同步公开仓库与贡献事件，作为项目、周报和职业时间线的私有证据来源。"
        action={(
          <button type="button" className={styles.primaryButton} onClick={synchronize} disabled={!state.config?.enabled || syncing || saving}>
            {syncing ? <LoaderCircle className={styles.spin} size={17} /> : <RefreshCw size={17} />}
            {syncing ? "同步中" : "立即同步"}
          </button>
        )}
      />

      <div className={styles.metrics}>
        <article><span>同步仓库</span><strong>{state.repositories.length}</strong></article>
        <article><span>已选项目</span><strong>{selectedCount}</strong></article>
        <article><span>公开事件</span><strong>{state.events.length}</strong></article>
        <article><span>最近同步</span><strong className={styles.githubMetricText}>{formatDate(state.config?.lastSyncedAt ?? null)}</strong></article>
      </div>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>SOURCE</span><h2>同步设置</h2></div>
          <span className={state.config?.lastSyncStatus === "SUCCESS" ? `${styles.statusBadge} ${styles.statusActive}` : styles.statusBadge}>
            {state.config?.lastSyncStatus === "SUCCESS" ? "同步正常" : state.config?.lastSyncStatus === "FAILED" ? "同步失败" : "尚未同步"}
          </span>
        </div>
        <form className={styles.githubConfigForm} onSubmit={saveConfig}>
          <label><span>GitHub 用户名</span><input name="username" required maxLength={39} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="SEVENTEEN-TAN" /></label>
          <label className={styles.githubToggle}>
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            <span><strong>启用同步</strong><small>关闭后保留已有快照，但不能发起新的同步。</small></span>
          </label>
          <button className={styles.primaryButton} disabled={saving || syncing || !username.trim()}>
            {saving ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}
            {saving ? "保存中" : "保存配置"}
          </button>
        </form>
        {state.config?.lastSyncError ? <p className={styles.githubSyncError}>{state.config.lastSyncError}</p> : null}
        <p className={styles.mutedCopy}>可选的访问令牌只从服务器环境变量读取，不会保存到数据库或发送到浏览器。</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>PROJECT EVIDENCE</span><h2>仓库选择</h2></div>
          <span>{selectedCount} / {state.repositories.length} 个</span>
        </div>
        {state.repositories.length ? (
          <div className={styles.githubRepositoryList}>{state.repositories.map((repository) => (
            <label key={repository.id} className={styles.githubRepositoryRow}>
              <input type="checkbox" checked={selectedRepositories.has(repository.fullName)} onChange={() => toggleRepository(repository.fullName)} />
              <span className={styles.githubRepositoryCopy}>
                <strong>{repository.fullName}</strong>
                <small>{repository.description || "暂无仓库说明"}</small>
                <span className={styles.githubRepositoryMeta}>
                  {repository.primaryLanguage ? <span>{repository.primaryLanguage}</span> : null}
                  <span><Star size={12} />{repository.stars}</span>
                  <span><GitFork size={12} />{repository.forks}</span>
                  {repository.isFork ? <span>Fork</span> : null}
                  {repository.isArchived ? <span>已归档</span> : null}
                </span>
              </span>
              <a href={repository.htmlUrl} target="_blank" rel="noreferrer" aria-label={`打开 GitHub 仓库 ${repository.fullName}`} onClick={(event) => event.stopPropagation()}><ExternalLink size={16} /></a>
            </label>
          ))}</div>
        ) : (
          <EmptyState title="还没有仓库快照" description="先保存 GitHub 用户名，再执行一次同步。" action={null} />
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.kicker}>PUBLIC EVENTS</span><h2>近期贡献事件</h2></div>
          <span>显示 {visibleEvents.length} / {state.events.length} 条</span>
        </div>
        {state.events.length ? (
          <div className={styles.githubEventList}>{visibleEvents.map((event) => (
            <article key={event.id} className={styles.githubEventRow}>
              <Activity size={16} aria-hidden="true" />
              <div><strong>{eventLabel(event.type)}</strong><span>{event.repository}</span></div>
              <time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time>
              {event.url ? <a href={event.url} target="_blank" rel="noreferrer" aria-label={`打开 ${event.repository}`}><ExternalLink size={15} /></a> : null}
            </article>
          ))}</div>
        ) : <p className={styles.mutedCopy}>同步后将在这里显示 GitHub 提供的近期公开事件。</p>}
      </section>

      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
