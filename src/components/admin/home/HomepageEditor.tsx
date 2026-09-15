import { ImageIcon, Plus } from "lucide-react";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";

import styles from "../../../app/admin/admin.module.css";
import type { LocalizedSiteContent, SiteContent } from "../../../lib/content/schema";
import type { AssetData } from "../types";
import { AssetPicker } from "./AssetPicker";
import { CollectionControls } from "./CollectionControls";
import {
  type ContentPath,
  type SiteContentValidation,
  type SiteLocale,
  type SiteSectionId,
  updateContentAtPath,
} from "./content-editor";
import { FieldError } from "./FieldError";

type HomeSectionDefinition = {
  id: SiteSectionId;
  label: string;
};

type HomeTaskDefinition = {
  id: "identity" | "capability" | "projects" | "contact";
  label: string;
  sections: readonly HomeSectionDefinition[];
};

const HOME_SECTION_DEFINITIONS: readonly HomeSectionDefinition[] = [
  { id: "meta", label: "站点信息" },
  { id: "nav", label: "导航" },
  { id: "hero", label: "首屏" },
  { id: "about", label: "关于" },
  { id: "services", label: "服务" },
  { id: "works", label: "作品" },
  { id: "projects", label: "项目" },
  { id: "footer", label: "页脚" },
];

export const HOME_TASK_DEFINITIONS: readonly HomeTaskDefinition[] = [
  {
    id: "identity",
    label: "个人与首屏",
    sections: [
      { id: "meta", label: "站点信息" },
      { id: "hero", label: "首屏" },
      { id: "about", label: "关于" },
    ],
  },
  {
    id: "capability",
    label: "能力展示",
    sections: [
      { id: "about", label: "关于" },
      { id: "services", label: "服务" },
    ],
  },
  {
    id: "projects",
    label: "项目展示",
    sections: [
      { id: "works", label: "作品" },
      { id: "projects", label: "项目" },
    ],
  },
  {
    id: "contact",
    label: "联系与导航",
    sections: [
      { id: "nav", label: "导航" },
      { id: "footer", label: "页脚" },
    ],
  },
];

type HomeTaskId = (typeof HOME_TASK_DEFINITIONS)[number]["id"];

type ScalarField = {
  key: string;
  label: string;
  long?: boolean;
  advanced?: boolean;
};

const SCALAR_FIELDS: Record<Exclude<SiteSectionId, "about" | "services" | "footer" | "projects">, ScalarField[]> = {
  meta: [
    { key: "title", label: "页面标题" },
    { key: "description", label: "页面描述", long: true },
  ],
  nav: [
    { key: "brand", label: "品牌名称" },
    { key: "about", label: "关于导航" },
    { key: "work", label: "作品导航" },
    { key: "contact", label: "联系导航" },
    { key: "top", label: "返回顶部", advanced: true },
    { key: "goContact", label: "前往联系", advanced: true },
    { key: "switchLanguage", label: "切换语言提示", advanced: true },
    { key: "switchLabel", label: "语言切换标签", advanced: true },
  ],
  hero: [
    { key: "backdrop", label: "背景文字" },
    { key: "role", label: "身份角色" },
    { key: "lineOne", label: "标题第一行" },
    { key: "lineTwo", label: "标题第二行" },
    { key: "intro", label: "介绍", long: true },
    { key: "work", label: "作品按钮" },
    { key: "contact", label: "联系按钮" },
    { key: "headingLabel", label: "标题无障碍标签", advanced: true },
    { key: "badgeArea", label: "徽章区域", advanced: true },
    { key: "badgeLabel", label: "徽章标签", advanced: true },
    { key: "portraitAlt", label: "头像替代文本", advanced: true },
    { key: "badgeRole", label: "徽章角色", advanced: true },
    { key: "active", label: "在线状态", advanced: true },
  ],
  works: [
    { key: "eyebrow", label: "眉题" },
    { key: "heading", label: "标题" },
    { key: "viewAll", label: "查看全部" },
    { key: "explore", label: "探索提示" },
    { key: "navigation", label: "项目导航", advanced: true },
    { key: "project", label: "项目标签", advanced: true },
    { key: "showProject", label: "展示项目", advanced: true },
  ],
};

const ABOUT_SCALARS: ScalarField[] = [
  { key: "eyebrow", label: "眉题" },
  { key: "headingLabel", label: "标题无障碍标签", advanced: true },
  { key: "toolkit", label: "工具箱标题" },
  { key: "skillCount", label: "技能数量文案" },
  { key: "quote", label: "引语", long: true },
];

const SERVICE_SCALARS: ScalarField[] = [
  { key: "eyebrow", label: "眉题" },
  { key: "headingStart", label: "标题开头" },
  { key: "headingOutline", label: "标题描边部分" },
  { key: "headingLabel", label: "标题无障碍标签", advanced: true },
];

const FOOTER_SCALARS: ScalarField[] = [
  { key: "eyebrow", label: "眉题" },
  { key: "backdrop", label: "背景文字", advanced: true },
  { key: "headingLabel", label: "标题无障碍标签", advanced: true },
  { key: "intro", label: "介绍", long: true },
  { key: "menu", label: "菜单标题" },
  { key: "socials", label: "社交标题" },
  { key: "github", label: "GitHub 文案" },
  { key: "wechat", label: "微信文案" },
  { key: "wechatHint", label: "微信提示", long: true, advanced: true },
  { key: "wechatAlt", label: "微信二维码替代文本", advanced: true },
  { key: "copyright", label: "版权文案" },
  { key: "privacy", label: "隐私文案", advanced: true },
  { key: "terms", label: "条款文案", advanced: true },
];

interface HomepageEditorProps {
  assets: AssetData[];
  content: SiteContent;
  validation: SiteContentValidation;
  onContentChange: (content: SiteContent) => void;
}

function pathId(path: string) {
  return `homepage-${path.replaceAll(".", "-")}`;
}

function valueAtPath(value: unknown, path: ContentPath) {
  return path.reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string | number, unknown>)[segment];
  }, value);
}

function sectionDefinition(section: SiteSectionId) {
  return HOME_SECTION_DEFINITIONS.find((item) => item.id === section);
}

export function HomepageEditor({ assets, content, validation, onContentChange }: HomepageEditorProps) {
  const [task, setTask] = useState<HomeTaskId>("identity");
  const [assetPath, setAssetPath] = useState<{ path: ContentPath; locale: SiteLocale } | null>(null);
  const assetPickerTriggerRef = useRef<HTMLButtonElement | null>(null);

  function update(locale: SiteLocale, path: ContentPath, value: unknown) {
    onContentChange(updateContentAtPath(content, [locale, ...path], value));
  }

  function field(locale: SiteLocale, path: ContentPath, label: string, value: string, long = false) {
    const exactPath = [locale, ...path].join(".");
    const error = validation.fieldErrors[exactPath];
    const inputId = pathId(exactPath);
    const errorId = `${inputId}-error`;
    const commonProps = {
      id: inputId,
      value,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errorId : undefined,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(locale, path, event.target.value),
    };

    return (
      <label key={exactPath} className={styles.homeField} htmlFor={inputId}>
        <span>{label}</span>
        {long ? <textarea {...commonProps} rows={4} /> : <input {...commonProps} type="text" />}
        <FieldError id={errorId} path={exactPath} message={error} />
      </label>
    );
  }

  function pairedField(path: ContentPath, label: string, long = false) {
    return (
      <div className={styles.pairedFields} key={path.join(".")}>
        {field("zh", path, "中文内容", valueAtPath(content.zh, path) as string, long)}
        {field("en", path, "English content", valueAtPath(content.en, path) as string, long)}
        <span className={styles.pairedFieldLabel}>{label}</span>
      </div>
    );
  }

  function imageField(locale: SiteLocale, path: ContentPath) {
    return (
      <div className={styles.assetFieldControl}>
        {field(locale, path, "图片路径或 URL", valueAtPath(content[locale], path) as string)}
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={(event) => {
            assetPickerTriggerRef.current = event.currentTarget;
            setAssetPath({ path, locale });
          }}
        >
          <ImageIcon size={17} />选择媒体
        </button>
      </div>
    );
  }

  function scalarFields(sectionId: keyof LocalizedSiteContent, fields: ScalarField[]) {
    const primary = fields.filter((item) => !item.advanced);
    const advanced = fields.filter((item) => item.advanced);

    return (
      <>
        {primary.map(({ key, label, long }) => pairedField([sectionId, key], label, long))}
        {advanced.length ? (
          <details className={styles.advancedCopy}>
            <summary>高级文案</summary>
            <div className={styles.homeFormGrid}>
              {advanced.map(({ key, label, long }) => pairedField([sectionId, key], label, long))}
            </div>
          </details>
        ) : null}
      </>
    );
  }

  function updateCollection(locale: SiteLocale, path: ContentPath, items: unknown[], index: number, action: "add" | "remove" | "up" | "down", blank: unknown) {
    const next = [...items];
    if (action === "add") next.splice(index + 1, 0, blank);
    if (action === "remove") next.splice(index, 1);
    if (action === "up" && index > 0) [next[index - 1], next[index]] = [next[index], next[index - 1]];
    if (action === "down" && index < next.length - 1) [next[index], next[index + 1]] = [next[index + 1], next[index]];
    update(locale, path, next);
  }

  function controls(locale: SiteLocale, path: ContentPath, items: unknown[], index: number, label: string, blank: unknown, minimum = 1) {
    return (
      <div className={styles.collectionControlsGroup}>
        <span>{locale === "zh" ? "中文" : "EN"}</span>
        <CollectionControls
          label={`${locale === "zh" ? "中文" : "English"}${label}`}
          index={index}
          count={items.length}
          minimum={minimum}
          onAdd={() => updateCollection(locale, path, items, index, "add", blank)}
          onRemove={() => updateCollection(locale, path, items, index, "remove", blank)}
          onMoveUp={() => updateCollection(locale, path, items, index, "up", blank)}
          onMoveDown={() => updateCollection(locale, path, items, index, "down", blank)}
        />
      </div>
    );
  }

  function pairedCollection(
    path: ContentPath,
    label: string,
    blank: unknown,
    renderItem: (locale: SiteLocale, index: number) => ReactNode,
    minimum = 1,
  ) {
    const zhItems = valueAtPath(content.zh, path) as unknown[];
    const enItems = valueAtPath(content.en, path) as unknown[];
    const count = Math.max(zhItems.length, enItems.length);

    return Array.from({ length: count }, (_, index) => (
      <div className={styles.collectionItem} key={`${path.join(".")}-${index}`}>
        <div className={styles.pairedFields}>
          {index < zhItems.length ? renderItem("zh", index) : null}
          {index < enItems.length ? renderItem("en", index) : null}
        </div>
        <div className={styles.collectionActions}>
          {index < zhItems.length ? controls("zh", path, zhItems, index, label, blank, minimum) : null}
          {index < enItems.length ? controls("en", path, enItems, index, label, blank, minimum) : null}
        </div>
      </div>
    ));
  }

  function renderAbout(scope: "identity" | "capability") {
    if (scope === "identity") {
      return (
        <>
          {scalarFields("about", ABOUT_SCALARS.slice(0, 2))}
          {pairedField(["about", "heading", 0], "标题第一段")}
          {pairedField(["about", "heading", 1], "标题第二段")}
          <div className={styles.collectionBlock}>
            <h3>介绍段落</h3>
            {pairedCollection(["about", "paragraphs"], "段落", "", (locale, index) =>
              field(locale, ["about", "paragraphs", index], locale === "zh" ? "中文内容" : "English content", valueAtPath(content[locale], ["about", "paragraphs", index]) as string, true))}
          </div>
          {pairedField(["about", "quote"], "引语", true)}
        </>
      );
    }

    return (
      <>
        <div className={styles.collectionBlock}>
          <h3>数据</h3>
          {pairedCollection(["about", "stats"], "数据项", { value: "", accent: "", label: "" }, (locale, index) => (
            <div className={styles.statEditor}>
              {field(locale, ["about", "stats", index, "value"], locale === "zh" ? "中文数值" : "English value", valueAtPath(content[locale], ["about", "stats", index, "value"]) as string)}
              {field(locale, ["about", "stats", index, "accent"], locale === "zh" ? "中文强调文本" : "English accent", valueAtPath(content[locale], ["about", "stats", index, "accent"]) as string)}
              {field(locale, ["about", "stats", index, "label"], locale === "zh" ? "中文标签" : "English label", valueAtPath(content[locale], ["about", "stats", index, "label"]) as string)}
            </div>
          ))}
        </div>
        {scalarFields("about", ABOUT_SCALARS.slice(2, 4))}
        <div className={styles.collectionBlock}>
          <h3>技能</h3>
          {pairedCollection(["about", "skills"], "技能", "", (locale, index) =>
            field(locale, ["about", "skills", index], locale === "zh" ? "中文内容" : "English content", valueAtPath(content[locale], ["about", "skills", index]) as string))}
        </div>
      </>
    );
  }

  function renderServices() {
    return (
      <>
        {scalarFields("services", SERVICE_SCALARS)}
        <div className={styles.collectionBlock}>
          <h3>服务项目</h3>
          {pairedCollection(["services", "items"], "服务项", ["", ""], (locale, index) => (
            <div className={styles.serviceEditor}>
              {field(locale, ["services", "items", index, 0], "服务名称", valueAtPath(content[locale], ["services", "items", index, 0]) as string)}
              {field(locale, ["services", "items", index, 1], "服务描述", valueAtPath(content[locale], ["services", "items", index, 1]) as string, true)}
            </div>
          ))}
        </div>
      </>
    );
  }

  function renderFooter() {
    return (
      <>
        {scalarFields("footer", FOOTER_SCALARS.slice(0, 3))}
        {pairedField(["footer", "heading", 0], "标题第一段")}
        {pairedField(["footer", "heading", 1], "标题第二段")}
        {scalarFields("footer", FOOTER_SCALARS.slice(3, 8))}
        <div className={styles.collectionBlock}>
          <h3>页脚链接</h3>
          {pairedCollection(["footer", "links"], "页脚链接", "", (locale, index) =>
            field(locale, ["footer", "links", index], locale === "zh" ? "中文内容" : "English content", valueAtPath(content[locale], ["footer", "links", index]) as string))}
        </div>
        {scalarFields("footer", FOOTER_SCALARS.slice(8))}
      </>
    );
  }

  function renderProjects() {
    const blankProject = { image: "", category: "", title: "", description: "", tags: [""] as string[], alt: "" };
    const projectCount = Math.max(content.zh.projects.length, content.en.projects.length);

    if (projectCount === 0) {
      return (
        <div className={styles.emptyProjects}>
          <p>当前内容还没有项目。</p>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => onContentChange({ ...content, zh: { ...content.zh, projects: [blankProject] }, en: { ...content.en, projects: [blankProject] } })}
          >
            <Plus size={17} />添加项目
          </button>
        </div>
      );
    }

    return Array.from({ length: projectCount }, (_, projectIndex) => {
      const zhProject = content.zh.projects[projectIndex];
      const enProject = content.en.projects[projectIndex];

      if (!zhProject || !enProject) {
        const missingLocale: SiteLocale = zhProject ? "en" : "zh";
        return (
          <article className={styles.projectEditor} key={`project-${projectIndex}`}>
            <h3>项目 {projectIndex + 1}</h3>
            <p>该项目缺少{missingLocale === "zh" ? "中文" : "英文"}内容。</p>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                const projects = [...content[missingLocale].projects];
                projects.splice(projectIndex, 0, blankProject);
                onContentChange({ ...content, [missingLocale]: { ...content[missingLocale], projects } });
              }}
            >
              <Plus size={17} />补充{missingLocale === "zh" ? "中文" : "英文"}项目
            </button>
          </article>
        );
      }

      return (
        <article className={styles.projectEditor} key={`project-${projectIndex}`}>
          <h3>项目 {projectIndex + 1}</h3>
          {pairedField(["projects", projectIndex, "title"], "项目标题")}
          {pairedField(["projects", projectIndex, "category"], "项目类别")}
          {pairedField(["projects", projectIndex, "description"], "项目描述", true)}
          {pairedImageField(projectIndex)}
          <details className={styles.advancedCopy}>
            <summary>高级文案</summary>
            {pairedField(["projects", projectIndex, "alt"], "图片替代文本")}
          </details>
          <div className={styles.collectionBlock}>
            <h3>项目标签</h3>
            {pairedCollection(["projects", projectIndex, "tags"], "项目标签", "", (locale, tagIndex) =>
              field(locale, ["projects", projectIndex, "tags", tagIndex], locale === "zh" ? "中文内容" : "English content", valueAtPath(content[locale], ["projects", projectIndex, "tags", tagIndex]) as string))}
          </div>
          <div className={styles.collectionActions}>
            {controls("zh", ["projects"], content.zh.projects, projectIndex, "项目", blankProject, 0)}
            {controls("en", ["projects"], content.en.projects, projectIndex, "项目", blankProject, 0)}
          </div>
        </article>
      );
    });
  }

  function pairedImageField(projectIndex: number) {
    return (
      <div className={styles.pairedFields}>
        {imageField("zh", ["projects", projectIndex, "image"])}
        {imageField("en", ["projects", projectIndex, "image"])}
      </div>
    );
  }

  function renderSection(section: SiteSectionId) {
    return (
      <section className={styles.homeSection} key={section} aria-labelledby={`homepage-section-${section}`}>
        <h3 id={`homepage-section-${section}`}>{sectionDefinition(section)?.label}</h3>
        <div className={styles.homeFormGrid}>
          {section === "meta" || section === "nav" || section === "hero" || section === "works"
            ? scalarFields(section, SCALAR_FIELDS[section])
            : null}
          {section === "about" ? renderAbout(task === "capability" ? "capability" : "identity") : null}
          {section === "services" ? renderServices() : null}
          {section === "footer" ? renderFooter() : null}
          {section === "projects" ? renderProjects() : null}
        </div>
      </section>
    );
  }

  const activeTask = HOME_TASK_DEFINITIONS.find((item) => item.id === task) ?? HOME_TASK_DEFINITIONS[0];

  return (
    <div className={styles.homeEditor}>
      <div className={styles.homeEditorLayout}>
        <nav className={styles.sectionRail} aria-label="主页编辑任务">
          {HOME_TASK_DEFINITIONS.map(({ id, label, sections }) => {
            const count = sections.reduce(
              (total, section) =>
                total + (validation.sectionErrorCounts[`zh.${section.id}`] ?? 0) + (validation.sectionErrorCounts[`en.${section.id}`] ?? 0),
              0,
            );
            return (
              <button key={id} type="button" aria-current={task === id ? "page" : undefined} onClick={() => setTask(id)}>
                <span>{label}</span>
                {count > 0 ? <strong aria-label={`${count} 个问题`}>{count}</strong> : null}
              </button>
            );
          })}
        </nav>
        <section className={styles.homeFormSurface} aria-labelledby="homepage-task-title">
          <div className={styles.homeFormHeading}>
            <span className={styles.kicker}>RESUME TASK</span>
            <h2 id="homepage-task-title">{activeTask.label}</h2>
          </div>
          <div className={styles.homeTaskContent}>
            {activeTask.sections.map(({ id }) => renderSection(id))}
          </div>
        </section>
      </div>
      <AssetPicker
        assets={assets}
        open={Boolean(assetPath)}
        triggerRef={assetPickerTriggerRef}
        onClose={() => setAssetPath(null)}
        onSelect={(asset) => {
          if (assetPath) update(assetPath.locale, assetPath.path, `/api/assets/${asset.id}`);
          setAssetPath(null);
        }}
      />
    </div>
  );
}
