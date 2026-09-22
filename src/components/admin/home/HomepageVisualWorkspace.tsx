import Image from "next/image";
import { useState, type ChangeEvent, type RefObject } from "react";

import styles from "../../../app/admin/admin.module.css";
import type { SiteContent } from "../../../lib/content/schema";
import { type SiteContentValidation, type SiteLocale, updateVisualContent } from "./content-editor";
import { getVisualEditField, type HomePreviewSection, type HomepageImagePath } from "./visual-editor-protocol";

export const HOME_VISUAL_STRUCTURE = [
  { id: "identity", label: "首屏", source: "snapshot" },
  { id: "about", label: "关于", source: "snapshot" },
  { id: "now", label: "当前动态", source: "business", adminHref: "/admin/activities" },
  { id: "work", label: "项目", source: "mixed", adminHref: "/admin/projects" },
  { id: "capability", label: "能力", source: "business", adminHref: "/admin/skills" },
  { id: "journey", label: "经历与简历", source: "business", adminHref: "/admin/experience" },
  { id: "contact", label: "联系", source: "snapshot" },
] as const;

type HomepageVisualWorkspaceProps = {
  content: SiteContent;
  validation: SiteContentValidation;
  dirty: boolean;
  locale: SiteLocale;
  device: "desktop" | "mobile";
  selectedPath: string | null;
  previewStatus: "loading" | "ready" | "error";
  previewKey: number;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onLocaleChange(locale: SiteLocale): void;
  onDeviceChange(device: "desktop" | "mobile"): void;
  onSelectedPathChange(path: string | null): void;
  onContentChange(content: SiteContent): void;
  onFocusSection(section: HomePreviewSection): void;
  onRequestAsset(path: HomepageImagePath, trigger: HTMLButtonElement): void;
  onPreviewLoad(): void;
  onRetryPreview(): void;
  onOpenFields(): void;
};

const sourceLabels = {
  snapshot: "本页文案可编辑",
  business: "来自业务模块",
  mixed: "本页文案 + 项目模块",
} as const;

function imageValue(content: SiteContent, path: HomepageImagePath) {
  return path === "settings.portraitImage" ? content.settings.portraitImage : content.settings.wechatQrImage;
}

export function HomepageVisualWorkspace({
  content,
  validation,
  dirty,
  locale,
  device,
  selectedPath,
  previewStatus,
  previewKey,
  iframeRef,
  onLocaleChange,
  onDeviceChange,
  onSelectedPathChange,
  onContentChange,
  onFocusSection,
  onRequestAsset,
  onPreviewLoad,
  onRetryPreview,
  onOpenFields,
}: HomepageVisualWorkspaceProps) {
  const [activePane, setActivePane] = useState<"structure" | "preview" | "inspector">("preview");
  const field = getVisualEditField(content, selectedPath);
  const fieldError = field ? validation.fieldErrors[field.path] : undefined;

  function updateLink(path: "settings.email" | "settings.githubUrl", event: ChangeEvent<HTMLInputElement>) {
    onContentChange(updateVisualContent(content, path, event.target.value));
  }

  return (
    <section className={styles.homeVisualWorkspace} aria-label="主页可视化编辑器">
      <div className={styles.homeVisualPaneTabs} role="tablist" aria-label="可视化编辑面板">
        <button type="button" role="tab" aria-selected={activePane === "structure"} onClick={() => setActivePane("structure")}>页面结构</button>
        <button type="button" role="tab" aria-selected={activePane === "preview"} onClick={() => setActivePane("preview")}>真实首页预览</button>
        <button type="button" role="tab" aria-selected={activePane === "inspector"} onClick={() => setActivePane("inspector")}>选中项设置</button>
      </div>
      <div className={styles.homeVisualLayout}>
        <aside className={styles.homeVisualPane} data-mobile-active={activePane === "structure"} aria-label="页面结构">
          <div className={styles.homeVisualPaneHeading}><span className={styles.kicker}>STRUCTURE</span><h2>页面结构</h2></div>
          <div className={styles.homeVisualStructureList}>
            {HOME_VISUAL_STRUCTURE.map((section) => (
              <article key={section.id}>
                <button type="button" onClick={() => { onSelectedPathChange(null); onFocusSection(section.id); }}>
                  <strong>{section.label}</strong><span>{sourceLabels[section.source]}</span>
                </button>
                {"adminHref" in section ? <a href={section.adminHref}>管理{section.label}</a> : null}
              </article>
            ))}
          </div>
        </aside>
        <section className={styles.homeVisualPane} data-mobile-active={activePane === "preview"} aria-label="真实首页预览">
          <div className={styles.homeVisualPreviewHeader}>
            <div className={styles.homeVisualPaneHeading}><span className={styles.kicker}>LIVE WORK COPY</span><h2>真实首页预览</h2></div>
            <div className={styles.homeVisualControls}>
              <div aria-label="预览设备"><button type="button" aria-pressed={device === "desktop"} onClick={() => onDeviceChange("desktop")}>桌面预览</button><button type="button" aria-pressed={device === "mobile"} onClick={() => onDeviceChange("mobile")}>手机预览</button></div>
              <div aria-label="预览语言"><button type="button" aria-pressed={locale === "zh"} onClick={() => onLocaleChange("zh")}>中文</button><button type="button" aria-pressed={locale === "en"} onClick={() => onLocaleChange("en")}>English</button></div>
            </div>
          </div>
          <p className={styles.homePreviewStatus} role="status">{previewStatus === "error" ? "预览加载失败，工作副本仍可继续编辑。" : previewStatus === "loading" ? "预览加载中" : "预览已同步当前工作副本。"}</p>
          <div className={styles.homePreviewFrameWrap}><iframe key={previewKey} ref={iframeRef} onLoad={onPreviewLoad} title="真实首页预览" src="/admin/home/visual-preview" className={styles.homePreviewFrame} data-device={device} /></div>
        </section>
        <aside className={styles.homeVisualPane} data-mobile-active={activePane === "inspector"} aria-label="选中项设置">
          <div className={styles.homeVisualPaneHeading}><span className={styles.kicker}>INSPECTOR</span><h2>选中项设置</h2></div>
          {!field ? <div className={styles.homeVisualInspectorEmpty}><p>在预览中选择可编辑文案、联系方式或图片，随后会在这里显示设置。</p><p>{dirty ? "当前工作副本有未保存修改。" : "当前工作副本与已保存草稿一致。"}</p></div>
            : field.kind === "text" ? <div className={styles.homeVisualInspector}><strong>{field.label}</strong><small>{field.path}</small>{fieldError ? <p role="alert">{fieldError}</p> : <p>当前字段有效。</p>}<p>请在页面原位编辑</p></div>
              : field.kind === "link" ? <label className={styles.homeField} htmlFor={`homepage-visual-${field.path}`}><span>{field.label}</span><input id={`homepage-visual-${field.path}`} type="text" value={field.path === "settings.email" ? content.settings.email : content.settings.githubUrl} aria-invalid={fieldError ? true : undefined} onChange={(event) => updateLink(field.path as "settings.email" | "settings.githubUrl", event)} />{fieldError ? <span role="alert">{fieldError}</span> : null}</label>
                : <div className={styles.homeVisualInspector}><strong>{field.label}</strong><Image src={imageValue(content, field.path as HomepageImagePath)} alt="" width={160} height={120} unoptimized /><button type="button" className={styles.secondaryButton} onClick={(event) => onRequestAsset(field.path as HomepageImagePath, event.currentTarget)}>替换图片</button><p>替代文本：{field.altPaths ? <><a href={`#homepage-${field.altPaths.zh.replaceAll(".", "-")}`} onClick={onOpenFields}>中文</a> / <a href={`#homepage-${field.altPaths.en.replaceAll(".", "-")}`} onClick={onOpenFields}>English</a></> : null}</p></div>}
          {previewStatus === "error" ? <div className={styles.homePreviewRecovery}><button type="button" className={styles.secondaryButton} onClick={onRetryPreview}>重试预览</button><button type="button" onClick={onOpenFields}>转到字段编辑</button></div> : null}
        </aside>
      </div>
    </section>
  );
}
