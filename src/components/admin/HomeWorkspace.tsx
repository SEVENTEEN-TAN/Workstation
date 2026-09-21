"use client";

import { ExternalLink, LoaderCircle, RefreshCw, RotateCcw, Send, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { siteContentSchema, type SiteContent } from "../../lib/content/schema";
import { HomepageEditor } from "./home/HomepageEditor";
import { isSiteContentDirty, updateVisualContent, validateSiteContent } from "./home/content-editor";
import { parseIframeMessage } from "./home/visual-editor-protocol";
import { adminRequest } from "./request";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState } from "./EmptyState";
import { FeedbackCenter } from "./FeedbackCenter";
import { PageHeader } from "./PageHeader";
import type { AssetData, PortfolioProjectData, SiteVersionData } from "./types";
import { useAdminAction } from "./useAdminAction";
import { jsonRequest } from "./workspace-utils";

interface HomeWorkspaceProps {
  initialDraft: SiteVersionData;
  initialVersions: SiteVersionData[];
  initialProjects: PortfolioProjectData[];
  assets: AssetData[];
}

function formatVersionDate(version: SiteVersionData) {
  const value = version.updatedAt ?? version.createdAt;
  return value ? new Date(value).toLocaleString("zh-CN") : "未知时间";
}

export function HomeWorkspace({ initialDraft, initialVersions, initialProjects }: HomeWorkspaceProps) {
  const [draft, setDraft] = useState(initialDraft);
  const projects = initialProjects;
  const initialContent = useMemo(() => siteContentSchema.parse(initialDraft.content), [initialDraft.content]);
  const [content, setContent] = useState<SiteContent>(initialContent);
  const [savedContent, setSavedContent] = useState<SiteContent>(initialContent);
  const [view, setView] = useState<"edit" | "history">("edit");
  const [versions, setVersions] = useState(initialVersions);
  const [rollbackRequest, setRollbackRequest] = useState<SiteVersionData | null>(null);
  const visualPreviewRef = useRef<HTMLIFrameElement>(null);
  const [visualPreviewReady, setVisualPreviewReady] = useState(false);
  const rollbackTriggerRef = useRef<HTMLElement | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const validation = useMemo(() => validateSiteContent(content), [content]);
  const dirty = useMemo(() => isSiteContentDirty(content, savedContent), [content, savedContent]);

  useEffect(() => {
    function receivePreviewMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== visualPreviewRef.current?.contentWindow) return;
      const message = parseIframeMessage(event.data);
      if (message?.type === "homepage-editor:ready") setVisualPreviewReady(true);
      if (message?.type === "homepage-editor:commit") {
        try { setContent((current) => updateVisualContent(current, message.path, message.value)); } catch { /* Ignore rejected iframe messages. */ }
      }
    }

    window.addEventListener("message", receivePreviewMessage);
    return () => window.removeEventListener("message", receivePreviewMessage);
  }, []);

  useEffect(() => {
    if (!visualPreviewReady) return;
    visualPreviewRef.current?.contentWindow?.postMessage({ type: "homepage-editor:content", content }, window.location.origin);
  }, [content, visualPreviewReady]);

  useEffect(() => {
    if (!dirty) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function confirmSameOriginNavigation(event: globalThis.MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      if (!window.confirm("当前有未保存修改，确定离开此页面吗？")) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", confirmSameOriginNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", confirmSameOriginNavigation, true);
    };
  }, [dirty]);

  async function fetchHomeData(): Promise<void> {
    const [nextDraft, nextVersions] = await Promise.all([
      adminRequest<SiteVersionData>("/api/admin/site/draft"),
      adminRequest<SiteVersionData[]>("/api/admin/site/versions"),
    ]);
    const nextContent = siteContentSchema.parse(nextDraft.content);
    setDraft(nextDraft);
    setContent(nextContent);
    setSavedContent(nextContent);
    setVersions(nextVersions);
  }

  async function refreshHome() {
    if (dirty && !window.confirm("刷新会丢弃当前未保存修改，确定继续吗？")) return;
    await runAction("home:refresh", fetchHomeData, "主页内容已更新");
  }

  async function saveDraft() {
    await runAction("home:save", async () => {
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

  function requestRollback(event: MouseEvent<HTMLButtonElement>, version: SiteVersionData) {
    rollbackTriggerRef.current = event.currentTarget;
    setRollbackRequest(version);
  }

  async function confirmRollback() {
    if (!rollbackRequest) return;
    const versionId = rollbackRequest.id;
    const result = await runAction(`home:rollback:${versionId}`, async () => {
      const nextDraft = await adminRequest<SiteVersionData>("/api/admin/site/rollback", jsonRequest("POST", { id: versionId }));
      const nextVersions = await adminRequest<SiteVersionData[]>("/api/admin/site/versions");
      const nextContent = siteContentSchema.parse(nextDraft.content);
      setDraft(nextDraft);
      setContent(nextContent);
      setSavedContent(nextContent);
      setVersions(nextVersions);
      return true;
    }, "已恢复为草稿，请预览后发布");
    if (result) setRollbackRequest(null);
  }

  const refreshBusy = isBusy("home:refresh");
  const saveBusy = isBusy("home:save");
  const publishBusy = isBusy("home:publish");
  const zhIssues = Object.keys(validation.fieldErrors).filter((path) => path.startsWith("zh.")).length;
  const enIssues = Object.keys(validation.fieldErrors).filter((path) => path.startsWith("en.")).length;

  return (
    <section>
      <PageHeader
        title="主页 CMS"
        description="维护公开主页的完整双语内容，保存、预览确认后再发布。"
        action={(
          <button type="button" className={styles.iconTextButton} onClick={refreshHome} disabled={refreshBusy}>
            {refreshBusy ? <LoaderCircle className={styles.spin} size={18} /> : <RefreshCw size={18} />}
            {refreshBusy ? "刷新中" : "刷新"}
          </button>
        )}
      />

      <section className={styles.panel}>
        <div className={styles.homeActionBar} id="homeActionBar">
          <div>
            <span className={styles.kicker}>DRAFT v{draft.version}</span>
            <h2>结构化内容</h2>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryButton} onClick={saveDraft} disabled={!dirty || !validation.valid || saveBusy}>
              {saveBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}
              {saveBusy ? "保存中" : "保存草稿"}
            </button>
            <button type="button" onClick={() => window.open(`/preview?id=${draft.id}`, "_blank", "noopener,noreferrer")}>
              <ExternalLink size={17} />预览页面
            </button>
            <button type="button" onClick={publishDraft} disabled={!validation.valid || dirty || publishBusy}>
              {publishBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Send size={17} />}
              {publishBusy ? "发布中" : "发布"}
            </button>
          </div>
          <div className={styles.workspaceTabs} role="tablist" aria-label="主页管理视图">
            <button type="button" role="tab" aria-selected={view === "edit"} onClick={() => setView("edit")}>编辑内容</button>
            <button type="button" role="tab" aria-selected={view === "history"} onClick={() => setView("history")}>发布记录</button>
          </div>
        </div>
        {view === "edit" ? (
          <>
            <section className={styles.readinessSummary} aria-labelledby="publish-readiness-title">
              <div>
                <span className={styles.kicker}>READINESS</span>
                <h2 id="publish-readiness-title">发布就绪</h2>
              </div>
              <dl>
                <div><dt>中文</dt><dd>{zhIssues ? `${zhIssues} 个问题` : "完整"}</dd></div>
                <div><dt>English</dt><dd>{enIssues ? `${enIssues} 个问题` : "完整"}</dd></div>
                <div><dt>总计</dt><dd>{validation.errorCount ? `${validation.errorCount} 个问题` : "无问题"}</dd></div>
                <div><dt>状态</dt><dd>{dirty ? "有未保存修改" : "已保存"}</dd></div>
              </dl>
              <p>
                {validation.valid
                  ? dirty
                    ? "可保存；预览仍使用当前已保存草稿，不包含未保存修改。"
                    : "当前已保存草稿可预览并发布。"
                  : "请先修正两种语言中的内容问题，再保存、预览和发布。"}
              </p>
            </section>
            <section className={styles.panel} aria-label="主页实时预览">
              <iframe ref={visualPreviewRef} title="主页实时预览" src="/admin/home/visual-preview" className="min-h-[720px] w-full border-0 bg-ink" />
            </section>
            <HomepageEditor
              projects={projects}
              content={content}
              validation={validation}
              onContentChange={setContent}
            />
          </>
        ) : (
          <>
            <div className={styles.sectionHeading}><div><span className={styles.kicker}>HISTORY</span><h2>发布记录</h2></div></div>
            {versions.length ? versions.map((version) => {
              const busyKey = `home:rollback:${version.id}`;
              return (
                <div className={styles.listRow} key={version.id}>
                  <span><strong>v{version.version}</strong><small>{version.status}</small></span>
                  <time>{formatVersionDate(version)}</time>
                  <button type="button" onClick={(event) => requestRollback(event, version)} disabled={version.id === draft.id || isBusy(busyKey)}>
                    {isBusy(busyKey) ? <LoaderCircle className={styles.spin} size={16} /> : <RotateCcw size={16} />}
                    {isBusy(busyKey) ? "恢复中" : "恢复为草稿"}
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
          </>
        )}
      </section>
      <ConfirmDialog
        open={Boolean(rollbackRequest)}
        title="确认恢复主页版本为草稿"
        target={rollbackRequest ? `v${rollbackRequest.version}` : ""}
        description="当前未保存修改将被替换，公开内容保持不变。恢复后仍需明确预览并发布。"
        busy={rollbackRequest ? isBusy(`home:rollback:${rollbackRequest.id}`) : false}
        confirmLabel="恢复为草稿"
        busyLabel="恢复中"
        triggerRef={rollbackTriggerRef}
        onConfirm={confirmRollback}
        onCancel={() => setRollbackRequest(null)}
      />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
