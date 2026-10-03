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

type SectionId = typeof HOME_VISUAL_STRUCTURE[number]["id"];
type HomepageComposition = {
  sections: Array<{ id: SectionId; visible: boolean }>;
  template: "default" | "portfolio" | "compact";
};

const TEMPLATE_SECTIONS: Record<HomepageComposition["template"], readonly SectionId[]> = {
  default: ["identity", "about", "now", "work", "capability", "journey", "contact"],
  portfolio: ["identity", "work", "about", "capability", "journey", "now", "contact"],
  compact: ["identity", "about", "work", "contact"],
};

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
  onOpenFields(path?: string): void;
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
  const savedComposition = content.composition;
  const composition: HomepageComposition = savedComposition ?? {
    sections: HOME_VISUAL_STRUCTURE.map(({ id }) => ({ id, visible: true })),
    template: "default",
  };
  const availableSections = HOME_VISUAL_STRUCTURE.filter((section) => !composition.sections.some(({ id }) => id === section.id));

  function updateComposition(sections: HomepageComposition["sections"], template = composition.template) {
    onContentChange({ ...content, composition: { ...savedComposition, sections, template } });
  }

  function moveSection(index: number, direction: -1 | 1) {
    const sections = [...composition.sections];
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    updateComposition(sections);
  }

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
          <label className={styles.homeField} htmlFor="homepage-layout-template"><span>页面布局</span><select id="homepage-layout-template" value={composition.template} onChange={(event) => {
            const template = event.target.value as HomepageComposition["template"];
            updateComposition(TEMPLATE_SECTIONS[template].map((id) => ({ id, visible: true })), template);
          }}><option value="default">完整首页</option><option value="portfolio">作品优先</option><option value="compact">精简首页</option></select></label>
          <p className={styles.homePreviewStatus}>切换布局、隐藏或移除区块会保留已有内容。</p>
          <div className={styles.homeVisualStructureList}>
            {composition.sections.map((item, index) => {
              const section = HOME_VISUAL_STRUCTURE.find(({ id }) => id === item.id)!;
              return <article key={section.id}>
                <button type="button" disabled={!item.visible} onClick={() => { onSelectedPathChange(null); onFocusSection(section.id); }}>
                  <strong>{section.label}</strong><span>{sourceLabels[section.source]}</span>
                </button>
                <div className={styles.homeVisualControls} role="group" aria-label={`${section.label}区块操作`}>
                  <button type="button" aria-label={`上移${section.label}`} disabled={index === 0} onClick={() => moveSection(index, -1)}>上移</button>
                  <button type="button" aria-label={`下移${section.label}`} disabled={index === composition.sections.length - 1} onClick={() => moveSection(index, 1)}>下移</button>
                  <button type="button" aria-label={`${item.visible ? "隐藏" : "显示"}${section.label}`} aria-pressed={item.visible} onClick={() => updateComposition(composition.sections.map((entry) => entry.id === item.id ? { ...entry, visible: !entry.visible } : entry))}>{item.visible ? "隐藏" : "显示"}</button>
                  <button type="button" aria-label={`移除${section.label}`} onClick={() => { onSelectedPathChange(null); updateComposition(composition.sections.filter(({ id }) => id !== item.id)); }}>移除</button>
                </div>
                {"adminHref" in section ? <a href={section.adminHref}>管理{section.label}</a> : null}
              </article>;
            })}
          </div>
          <label className={styles.homeField} htmlFor="homepage-add-section"><span>添加预设区块</span><select id="homepage-add-section" value="" disabled={availableSections.length === 0} onChange={(event) => {
            if (event.target.value) updateComposition([...composition.sections, { id: event.target.value as SectionId, visible: true }]);
          }}><option value="">{availableSections.length ? "选择区块" : "已包含全部预设区块"}</option>{availableSections.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</select></label>
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
                : <div className={styles.homeVisualInspector}><strong>{field.label}</strong><Image src={imageValue(content, field.path as HomepageImagePath)} alt="" width={160} height={120} unoptimized /><button type="button" className={styles.secondaryButton} onClick={(event) => onRequestAsset(field.path as HomepageImagePath, event.currentTarget)}>替换图片</button><p>替代文本：{field.altPaths ? <><a href={`#homepage-${field.altPaths.zh.replaceAll(".", "-")}`} onClick={(event) => { event.preventDefault(); onOpenFields(field.altPaths?.zh); }}>中文</a> / <a href={`#homepage-${field.altPaths.en.replaceAll(".", "-")}`} onClick={(event) => { event.preventDefault(); onOpenFields(field.altPaths?.en); }}>English</a></> : null}</p></div>}
          {previewStatus === "error" ? <div className={styles.homePreviewRecovery}><button type="button" className={styles.secondaryButton} onClick={onRetryPreview}>重试预览</button><button type="button" onClick={() => onOpenFields()}>转到字段编辑</button></div> : null}
        </aside>
      </div>
    </section>
  );
}
