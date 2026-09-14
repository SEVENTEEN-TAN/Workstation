"use client";

import { ExternalLink, LoaderCircle, RefreshCw, RotateCcw, Send, Save } from "lucide-react";
import { useState } from "react";

import styles from "../../app/admin/admin.module.css";
import { adminRequest } from "./request";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import type { SiteVersionData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

interface HomeWorkspaceProps {
  initialDraft: SiteVersionData;
  initialVersions: SiteVersionData[];
}

function formatVersionDate(version: SiteVersionData) {
  const value = version.updatedAt ?? version.createdAt;
  return value ? new Date(value).toLocaleString("zh-CN") : "未知时间";
}

export function HomeWorkspace({ initialDraft, initialVersions }: HomeWorkspaceProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [draftText, setDraftText] = useState(() => JSON.stringify(initialDraft.content, null, 2));
  const [versions, setVersions] = useState(initialVersions);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();

  async function fetchHomeData() {
    const [nextDraft, nextVersions] = await Promise.all([
      adminRequest<SiteVersionData>("/api/admin/site/draft"),
      adminRequest<SiteVersionData[]>("/api/admin/site/versions"),
    ]);
    setDraft(nextDraft);
    setDraftText(JSON.stringify(nextDraft.content, null, 2));
    setVersions(nextVersions);
  }

  async function refreshHome() {
    await runAction("home:refresh", fetchHomeData, "主页内容已更新");
  }

  async function saveDraft() {
    await runAction("home:save", async () => {
      const content = JSON.parse(draftText) as unknown;
      await adminRequest("/api/admin/site/draft", jsonRequest("PUT", { id: draft.id, content }));
      await fetchHomeData();
    }, "草稿已保存");
  }

  async function publishDraft() {
    await runAction("home:publish", async () => {
      await adminRequest("/api/admin/site/publish", jsonRequest("POST", { id: draft.id }));
      await fetchHomeData();
    }, "主页已发布");
  }

  async function rollback(versionId: string) {
    await runAction(`home:rollback:${versionId}`, async () => {
      await adminRequest("/api/admin/site/rollback", jsonRequest("POST", { id: versionId }));
      await fetchHomeData();
    }, "版本已回滚并发布");
  }

  const refreshBusy = isBusy("home:refresh");

  return (
    <section>
      <PageHeader
        title="主页 CMS"
        description="维护公开主页的完整双语内容快照。结构化表单将在下一轮接入。"
        action={(
          <button type="button" className={styles.iconTextButton} onClick={refreshHome} disabled={refreshBusy}>
            {refreshBusy ? <LoaderCircle className={styles.spin} size={18} /> : <RefreshCw size={18} />}
            {refreshBusy ? "刷新中" : "刷新"}
          </button>
        )}
      />

      <section className={styles.panel}>
        <div className={styles.editorToolbar}>
          <div>
            <span className={styles.kicker}>DRAFT v{draft.version}</span>
            <h2>内容快照</h2>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={saveDraft} disabled={isBusy("home:save")}>
              {isBusy("home:save") ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}
              {isBusy("home:save") ? "保存中" : "保存草稿"}
            </button>
            <button type="button" onClick={() => window.open(`/preview?id=${draft.id}`, "_blank", "noopener,noreferrer")}>
              <ExternalLink size={17} />预览页面
            </button>
            <button type="button" onClick={publishDraft} disabled={isBusy("home:publish")}>
              {isBusy("home:publish") ? <LoaderCircle className={styles.spin} size={17} /> : <Send size={17} />}
              {isBusy("home:publish") ? "发布中" : "发布"}
            </button>
          </div>
        </div>
        <label className={styles.editorLabel}>
          <span>完整双语内容 JSON</span>
          <textarea
            className={styles.editor}
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            spellCheck={false}
          />
        </label>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.kicker}>HISTORY</span><h2>版本历史</h2></div></div>
        {versions.length ? versions.map((version) => {
          const busyKey = `home:rollback:${version.id}`;
          return (
            <div className={styles.listRow} key={version.id}>
              <span><strong>v{version.version}</strong><small>{version.status}</small></span>
              <time>{formatVersionDate(version)}</time>
              <button type="button" onClick={() => rollback(version.id)} disabled={version.id === draft.id || isBusy(busyKey)}>
                {isBusy(busyKey) ? <LoaderCircle className={styles.spin} size={16} /> : <RotateCcw size={16} />}
                {isBusy(busyKey) ? "回滚中" : "回滚"}
              </button>
            </div>
          );
        }) : (
          <EmptyState
            title="还没有版本记录"
            description="保存当前草稿后，版本会出现在这里。"
            action={<button type="button" className={styles.secondaryButton} onClick={saveDraft}>保存当前草稿</button>}
          />
        )}
      </section>
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
