"use client";

import { ExternalLink, LoaderCircle, RefreshCw, RotateCcw, Send, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import styles from "../../app/admin/admin.module.css";
import { inspectHomepageProjectSync, materializeHomepageProjects, type HomepageProjectField } from "../../lib/content/homepage-projects";
import { siteContentSchema, type SiteContent } from "../../lib/content/schema";
import { AssetPicker } from "./home/AssetPicker";
import { HomepageEditor } from "./home/HomepageEditor";
import { HomepageVisualWorkspace } from "./home/HomepageVisualWorkspace";
import { applyHomepageEditorChange, isSiteContentDirty, reconcileFetchedHomeContent, type SiteLocale, updateVisualContent, validateSiteContent } from "./home/content-editor";
import { getVisualEditField, isTrustedEditorMessage, parseIframeMessage, sendEditorPreviewState, type HomepageImagePath } from "./home/visual-editor-protocol";
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

const PROJECT_FIELD_LABELS: Record<HomepageProjectField, string> = {
  slug: "链接",
  image: "封面",
  category: "分类",
  title: "标题",
  description: "描述",
  tags: "技术标签",
  alt: "图片替代文本",
};

const UNAVAILABLE_REASONS = {
  missing: "已不存在",
  private: "未公开",
  incomplete: "资料不完整",
} as const;

export function HomeWorkspace({ initialDraft, initialVersions, initialProjects, assets }: HomeWorkspaceProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [projects, setProjects] = useState(initialProjects);
  const [projectCheckFailed, setProjectCheckFailed] = useState(false);
  const initialContent = useMemo(() => siteContentSchema.parse(initialDraft.content), [initialDraft.content]);
  const [content, setContent] = useState<SiteContent>(initialContent);
  const [savedContent, setSavedContent] = useState<SiteContent>(initialContent);
  const [view, setView] = useState<"visual" | "fields" | "history">("visual");
  const [initialFieldPath, setInitialFieldPath] = useState<string>();
  const [versions, setVersions] = useState(initialVersions);
  const [rollbackRequest, setRollbackRequest] = useState<SiteVersionData | null>(null);
  const visualPreviewRef = useRef<HTMLIFrameElement>(null);
  const contentRef = useRef(content);
  const localeRef = useRef<SiteLocale>("zh");
  const selectedPathRef = useRef<string | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);
  const flushRequestIdRef = useRef(0);
  const pendingFlushRef = useRef<{ id: number; resolve: () => void; reject: (error: Error) => void; timeout: number } | null>(null);
  const [assetTarget, setAssetTarget] = useState<HomepageImagePath | null>(null);
  const assetPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [previewLocale, setPreviewLocale] = useState<SiteLocale>("zh");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [previewStatus, setPreviewStatus] = useState<"loading" | "ready" | "error">("loading");
  const [previewKey, setPreviewKey] = useState(0);
  const rollbackTriggerRef = useRef<HTMLElement | null>(null);
  const { feedback, dismissFeedback, isBusy, runAction } = useAdminAction();
  const validation = useMemo(() => validateSiteContent(content), [content]);
  const dirty = useMemo(() => isSiteContentDirty(content, savedContent), [content, savedContent]);
  const savedSync = useMemo(() => inspectHomepageProjectSync(savedContent, projects), [savedContent, projects]);
  const workingSync = useMemo(() => inspectHomepageProjectSync(content, projects), [content, projects]);
  const previewContent = content;
  const previewContentRef = useRef(previewContent);
  const commitContent = useCallback((next: SiteContent) => {
    contentRef.current = next;
    previewContentRef.current = next;
    setContent(next);
  }, []);

  useEffect(() => {
    localeRef.current = previewLocale;
    selectedPathRef.current = selectedPath;
  }, [previewLocale, selectedPath]);

  function applyFieldChange(next: SiteContent) {
    try {
      commitContent(applyHomepageEditorChange(contentRef.current, next, projects));
    } catch (cause) {
      void runAction("home:project-selection", async () => { throw cause; });
    }
  }

  const clearPreviewTimeout = useCallback(() => {
    if (previewTimeoutRef.current !== null) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  }, []);

  const sendPreviewState = useCallback(() => {
    const target = visualPreviewRef.current?.contentWindow;
    if (!target) return;
    sendEditorPreviewState(target, window.location.origin, {
      content: previewContentRef.current,
      locale: localeRef.current,
      selectedPath: selectedPathRef.current,
    });
  }, []);

  const changePreviewLocale = useCallback((nextLocale: SiteLocale) => {
    setPreviewLocale(nextLocale);
    setSelectedPath((current) => {
      if (!current || (!current.startsWith("zh.") && !current.startsWith("en."))) return current;
      const counterpart = `${nextLocale}.${current.slice(3)}`;
      return getVisualEditField(contentRef.current, counterpart)?.path ?? null;
    });
  }, []);

  const handlePreviewLoad = useCallback(() => {
    if (pendingFlushRef.current) {
      window.clearTimeout(pendingFlushRef.current.timeout);
      pendingFlushRef.current.reject(new Error("首页预览已重新加载，请确认文字后重试。"));
      pendingFlushRef.current = null;
    }
    clearPreviewTimeout();
    setPreviewStatus("loading");
    previewTimeoutRef.current = window.setTimeout(() => {
      setPreviewStatus((current) => current === "loading" ? "error" : current);
    }, 10_000);
  }, [clearPreviewTimeout]);

  const retryPreview = useCallback(() => {
    clearPreviewTimeout();
    setPreviewStatus("loading");
    setPreviewKey((current) => current + 1);
  }, [clearPreviewTimeout]);

  useEffect(() => {
    function receivePreviewMessage(event: MessageEvent) {
      if (!isTrustedEditorMessage(event, window.location.origin, visualPreviewRef.current?.contentWindow ?? null)) return;
      const message = parseIframeMessage(event.data, contentRef.current);
      if (message?.type === "homepage-editor:ready") {
        clearPreviewTimeout();
        setPreviewStatus("ready");
        sendPreviewState();
      }
      if (message?.type === "homepage-editor:commit") {
        try { commitContent(updateVisualContent(contentRef.current, message.path, message.value)); } catch { /* Ignore rejected iframe messages. */ }
      }
      if (message?.type === "homepage-editor:flushed" && pendingFlushRef.current?.id === message.requestId) {
        window.clearTimeout(pendingFlushRef.current.timeout);
        pendingFlushRef.current.resolve();
        pendingFlushRef.current = null;
      }
      if (message?.type === "homepage-editor:locale") changePreviewLocale(message.locale);
      if (message?.type === "homepage-editor:select") setSelectedPath(message.path);
    }

    window.addEventListener("message", receivePreviewMessage);
    return () => {
      window.removeEventListener("message", receivePreviewMessage);
      clearPreviewTimeout();
    };
  }, [changePreviewLocale, clearPreviewTimeout, commitContent, sendPreviewState]);

  useEffect(() => {
    if (previewStatus === "ready") sendPreviewState();
  }, [content, previewLocale, previewStatus, selectedPath, sendPreviewState]);

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
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
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

  async function fetchHomeData(contentAtRequest: SiteContent): Promise<void> {
    const [nextDraft, nextVersions] = await Promise.all([
      adminRequest<SiteVersionData>("/api/admin/site/draft"),
      adminRequest<SiteVersionData[]>("/api/admin/site/versions"),
    ]);
    const nextContent = siteContentSchema.parse(nextDraft.content);
    setDraft(nextDraft);
    commitContent(reconcileFetchedHomeContent(contentRef.current, contentAtRequest, nextContent));
    setSavedContent(nextContent);
    setVersions(nextVersions);
  }

  async function changeView(next: typeof view, fieldPath?: string) {
    if (next === view) return;
    const flushed = await runAction("home:flush", async () => { await flushPreviewEdits(); return true; });
    if (flushed) {
      setInitialFieldPath(next === "fields" ? fieldPath : undefined);
      setView(next);
    }
  }

  async function refreshHome() {
    await runAction("home:operation", async () => {
      const flushed = await runAction("home:flush", async () => { await flushPreviewEdits(); return true; });
      if (!flushed) return;
      if (isSiteContentDirty(contentRef.current, savedContent) && !window.confirm("刷新会丢弃当前未保存修改，确定继续吗？")) return;
      const contentAtRequest = contentRef.current;
      await runAction("home:refresh", () => fetchHomeData(contentAtRequest), "主页内容已更新");
    });
  }

  function runHomeAction<T>(key: string, work: () => Promise<T>, successMessage: string) {
    return runAction("home:operation", () => runAction(key, work, successMessage));
  }

  function flushPreviewEdits() {
    const target = view === "visual" && previewStatus === "ready" ? visualPreviewRef.current?.contentWindow : null;
    if (!target) return Promise.resolve();
    if (pendingFlushRef.current) return Promise.reject(new Error("首页预览正在同步，请稍后重试。"));
    return new Promise<void>((resolve, reject) => {
      const id = ++flushRequestIdRef.current;
      const timeout = window.setTimeout(() => {
        pendingFlushRef.current = null;
        reject(new Error("未能同步首页预览中的文字，请重试保存。"));
      }, 3_000);
      pendingFlushRef.current = { id, resolve, reject, timeout };
      target.postMessage({ type: "homepage-editor:flush", requestId: id }, window.location.origin);
    });
  }

  async function saveDraft() {
    await runHomeAction("home:save", async () => {
      await flushPreviewEdits();
      if (!validateSiteContent(contentRef.current).valid) throw new Error("请先修正主页内容问题，再保存草稿。");
      const submittedContent = contentRef.current;
      await adminRequest("/api/admin/site/draft", jsonRequest("PUT", { id: draft.id, content: submittedContent }));
      await fetchHomeData(submittedContent);
    }, "草稿已保存");
  }

  async function publishDraft() {
    await runHomeAction("home:publish", async () => {
      await flushPreviewEdits();
      if (isSiteContentDirty(contentRef.current, savedContent)) throw new Error("首页还有未保存修改，请先保存草稿。");
      if (!validateSiteContent(contentRef.current).valid) throw new Error("请先修正主页内容问题，再发布。");
      const contentAtRequest = contentRef.current;
      await adminRequest("/api/admin/site/publish", jsonRequest("POST", { id: draft.id }));
      await fetchHomeData(contentAtRequest);
      router.refresh();
    }, "主页已发布");
  }

  async function checkProjectUpdates() {
    const checked = await runAction("home:check-projects", async () => {
      const latest = await adminRequest<PortfolioProjectData[]>("/api/admin/projects");
      setProjects(latest);
      return true;
    }, "项目资料已检查");
    setProjectCheckFailed(checked !== true);
  }

  async function syncProjectUpdates() {
    await runAction("home:sync-projects", async () => {
      commitContent(materializeHomepageProjects(contentRef.current, projects));
    }, "项目更新已同步到工作副本");
  }

  function requestAsset(path: HomepageImagePath, trigger: HTMLButtonElement) {
    assetPickerTriggerRef.current = trigger;
    setAssetTarget(path);
  }

  function requestRollback(event: MouseEvent<HTMLButtonElement>, version: SiteVersionData) {
    rollbackTriggerRef.current = event.currentTarget;
    setRollbackRequest(version);
  }

  async function confirmRollback() {
    if (!rollbackRequest) return;
    const versionId = rollbackRequest.id;
    const result = await runHomeAction(`home:rollback:${versionId}`, async () => {
      await flushPreviewEdits();
      const contentAtRequest = contentRef.current;
      const nextDraft = await adminRequest<SiteVersionData>("/api/admin/site/rollback", jsonRequest("POST", { id: versionId }));
      const nextVersions = await adminRequest<SiteVersionData[]>("/api/admin/site/versions");
      const nextContent = siteContentSchema.parse(nextDraft.content);
      setDraft(nextDraft);
      commitContent(reconcileFetchedHomeContent(contentRef.current, contentAtRequest, nextContent));
      setSavedContent(nextContent);
      setVersions(nextVersions);
      return true;
    }, "已恢复为草稿，请预览后发布");
    if (result) setRollbackRequest(null);
  }

  const refreshBusy = isBusy("home:refresh");
  const operationBusy = isBusy("home:operation");
  const saveBusy = isBusy("home:save");
  const publishBusy = isBusy("home:publish");
  const checkBusy = isBusy("home:check-projects");
  const syncBusy = isBusy("home:sync-projects");
  const showProjectSync = savedSync.status === "pending" || savedSync.status === "blocked" ||
    workingSync.status === "pending" || workingSync.status === "blocked";
  const zhIssues = Object.keys(validation.fieldErrors).filter((path) => path.startsWith("zh.")).length;
  const enIssues = Object.keys(validation.fieldErrors).filter((path) => path.startsWith("en.")).length;

  return (
    <section>
      <PageHeader
        title="主页 CMS"
        description="维护公开主页的完整双语内容，保存、预览确认后再发布。"
        action={(
          <button type="button" className={styles.iconTextButton} onClick={refreshHome} disabled={operationBusy}>
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
            <button type="button" className={styles.primaryButton} onClick={saveDraft} disabled={(view !== "visual" && (!dirty || !validation.valid)) || operationBusy}>
              {saveBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Save size={17} />}
              {saveBusy ? "保存中" : "保存草稿"}
            </button>
            <button type="button" onClick={() => window.open(`/preview?id=${draft.id}`, "_blank", "noopener,noreferrer")}>
              <ExternalLink size={17} />预览页面
            </button>
            <button type="button" onClick={publishDraft} disabled={!validation.valid || dirty || operationBusy}>
              {publishBusy ? <LoaderCircle className={styles.spin} size={17} /> : <Send size={17} />}
              {publishBusy ? "发布中" : "发布"}
            </button>
          </div>
          <div className={styles.workspaceTabs} role="tablist" aria-label="主页管理视图">
            <button type="button" role="tab" aria-selected={view === "visual"} onClick={() => changeView("visual")}>可视化编辑</button>
            <button type="button" role="tab" aria-selected={view === "fields"} onClick={() => changeView("fields")}>字段编辑</button>
            <button type="button" role="tab" aria-selected={view === "history"} onClick={() => changeView("history")}>发布记录</button>
          </div>
        </div>
        <section className={styles.readinessSummary} aria-label="首页项目同步">
          <div>
            <span className={styles.kicker}>PROJECT SYNC</span>
            <h2>首页项目卡片</h2>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={checkProjectUpdates} disabled={checkBusy}>
              {checkBusy ? "检查中" : "检查项目更新"}
            </button>
            {showProjectSync && (
              <button type="button" onClick={syncProjectUpdates}
                disabled={projectCheckFailed || checkBusy || syncBusy || workingSync.status !== "pending"}>
                {syncBusy ? "同步中" : "同步项目更新到工作副本"}
              </button>
            )}
          </div>
          <div>
            {workingSync.status === "legacy" && <p>旧版首页卡片不自动关联项目；选择项目后才能启用同步。</p>}
            {workingSync.status === "synced" && savedSync.status !== "pending" && <p>当前工作副本与已检查的项目资料一致。</p>}
            {workingSync.status === "pending" && (
              <>
                <p>项目卡片待同步。同步仅修改工作副本，不会自动保存或发布。</p>
                {workingSync.changes.map((change) => (
                  <p key={change.id}>{change.name}：{change.fields.map(({ locale, field }) =>
                    (locale === "zh" ? "中文" : "English") + PROJECT_FIELD_LABELS[field]).join("、")}</p>
                ))}
                {workingSync.extraCards && <p>存在多余的旧卡片，点击同步后会移除。</p>}
              </>
            )}
            {workingSync.status === "blocked" && (
              <>
                <p>源项目不可用，请先到 <a href="/admin/projects">项目管理</a> 修复，然后重新检查。</p>
                {workingSync.unavailable.map((item) => (
                  <p key={item.id}>{item.name}：{UNAVAILABLE_REASONS[item.reason]}</p>
                ))}
              </>
            )}
            {savedSync.status === "pending" && workingSync.status === "synced" && <p>项目更新已在工作副本中，请保存草稿后发布。</p>}
            {projectCheckFailed && <p>上次检查失败，请重试；在检查成功前不能同步。</p>}
          </div>
        </section>
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
              ? "实时可视化预览使用当前工作副本，单独打开的预览页面使用已保存草稿。"
              : "请先修正两种语言中的内容问题，再保存、预览和发布。"}
          </p>
        </section>
        {view === "visual" ? (
          <HomepageVisualWorkspace
            content={content}
            validation={validation}
            dirty={dirty}
            locale={previewLocale}
            device={previewDevice}
            selectedPath={selectedPath}
            previewStatus={previewStatus}
            previewKey={previewKey}
            iframeRef={visualPreviewRef}
            onLocaleChange={changePreviewLocale}
            onDeviceChange={setPreviewDevice}
            onSelectedPathChange={setSelectedPath}
            onContentChange={commitContent}
            onFocusSection={(section) => visualPreviewRef.current?.contentWindow?.postMessage({ type: "homepage-editor:focus", section }, window.location.origin)}
            onRequestAsset={requestAsset}
            onPreviewLoad={handlePreviewLoad}
            onRetryPreview={retryPreview}
            onOpenFields={(path) => changeView("fields", path)}
          />
        ) : view === "fields" ? (
          <>
            <HomepageEditor
              initialFieldPath={initialFieldPath}
              projects={projects}
              content={content}
              validation={validation}
              onContentChange={applyFieldChange}
              onRequestAsset={requestAsset}
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
                  <button type="button" onClick={(event) => requestRollback(event, version)} disabled={version.id === draft.id || operationBusy}>
                    {isBusy(busyKey) ? <LoaderCircle className={styles.spin} size={16} /> : <RotateCcw size={16} />}
                    {isBusy(busyKey) ? "恢复中" : "恢复为草稿"}
                  </button>
                </div>
              );
            }) : (
              <EmptyState
                title="还没有版本记录"
                description="保存当前草稿后，版本会出现在这里。"
                action={<button type="button" className={styles.secondaryButton} onClick={saveDraft} disabled={operationBusy}>保存当前草稿</button>}
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
        busy={operationBusy}
        confirmLabel="恢复为草稿"
        busyLabel="恢复中"
        triggerRef={rollbackTriggerRef}
        onConfirm={confirmRollback}
        onCancel={() => setRollbackRequest(null)}
      />
      <AssetPicker
        assets={assets}
        open={assetTarget !== null}
        triggerRef={assetPickerTriggerRef}
        onSelect={(asset) => {
          if (!assetTarget) return;
          commitContent(updateVisualContent(contentRef.current, assetTarget, `/api/assets/${asset.id}`));
          setAssetTarget(null);
        }}
        onClose={() => setAssetTarget(null)}
      />
      <FeedbackCenter feedback={feedback} onDismiss={dismissFeedback} />
    </section>
  );
}
