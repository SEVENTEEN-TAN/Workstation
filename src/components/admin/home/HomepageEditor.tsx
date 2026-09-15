import { ImageIcon, Plus } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";

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

export const HOME_SECTION_DEFINITIONS = [
  { id: "meta", label: "站点信息" },
  { id: "nav", label: "导航" },
  { id: "hero", label: "首屏" },
  { id: "about", label: "关于" },
  { id: "works", label: "作品" },
  { id: "services", label: "服务" },
  { id: "footer", label: "页脚" },
  { id: "projects", label: "项目" },
] as const satisfies readonly { id: SiteSectionId; label: string }[];

type ScalarField = {
  key: string;
  label: string;
  long?: boolean;
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
    { key: "top", label: "返回顶部" },
    { key: "goContact", label: "前往联系" },
    { key: "switchLanguage", label: "切换语言提示" },
    { key: "switchLabel", label: "语言切换标签" },
  ],
  hero: [
    { key: "backdrop", label: "背景文字" },
    { key: "role", label: "身份角色" },
    { key: "lineOne", label: "标题第一行" },
    { key: "lineTwo", label: "标题第二行" },
    { key: "headingLabel", label: "标题无障碍标签" },
    { key: "intro", label: "介绍", long: true },
    { key: "work", label: "作品按钮" },
    { key: "contact", label: "联系按钮" },
    { key: "badgeArea", label: "徽章区域" },
    { key: "badgeLabel", label: "徽章标签" },
    { key: "portraitAlt", label: "头像替代文本" },
    { key: "badgeRole", label: "徽章角色" },
    { key: "active", label: "在线状态" },
  ],
  works: [
    { key: "eyebrow", label: "眉题" },
    { key: "heading", label: "标题" },
    { key: "viewAll", label: "查看全部" },
    { key: "explore", label: "探索提示" },
    { key: "navigation", label: "项目导航" },
    { key: "project", label: "项目标签" },
    { key: "showProject", label: "展示项目" },
  ],
};

const ABOUT_SCALARS: ScalarField[] = [
  { key: "eyebrow", label: "眉题" },
  { key: "headingLabel", label: "标题无障碍标签" },
  { key: "toolkit", label: "工具箱标题" },
  { key: "skillCount", label: "技能数量文案" },
  { key: "quote", label: "引语", long: true },
];

const SERVICE_SCALARS: ScalarField[] = [
  { key: "eyebrow", label: "眉题" },
  { key: "headingStart", label: "标题开头" },
  { key: "headingOutline", label: "标题描边部分" },
  { key: "headingLabel", label: "标题无障碍标签" },
];

const FOOTER_SCALARS: ScalarField[] = [
  { key: "backdrop", label: "背景文字" },
  { key: "eyebrow", label: "眉题" },
  { key: "headingLabel", label: "标题无障碍标签" },
  { key: "intro", label: "介绍", long: true },
  { key: "menu", label: "菜单标题" },
  { key: "socials", label: "社交标题" },
  { key: "github", label: "GitHub 文案" },
  { key: "wechat", label: "微信文案" },
  { key: "wechatHint", label: "微信提示", long: true },
  { key: "wechatAlt", label: "微信二维码替代文本" },
  { key: "copyright", label: "版权文案" },
  { key: "privacy", label: "隐私文案" },
  { key: "terms", label: "条款文案" },
];

interface HomepageEditorProps {
  assets: AssetData[];
  content: SiteContent;
  locale: SiteLocale;
  section: SiteSectionId;
  validation: SiteContentValidation;
  onContentChange: (content: SiteContent) => void;
  onLocaleChange: (locale: SiteLocale) => void;
  onSectionChange: (section: SiteSectionId) => void;
}

function pathId(path: string) {
  return `homepage-${path.replaceAll(".", "-")}`;
}

export function HomepageEditor({
  assets,
  content,
  locale,
  section,
  validation,
  onContentChange,
  onLocaleChange,
  onSectionChange,
}: HomepageEditorProps) {
  const localized = content[locale];
  const [assetPath, setAssetPath] = useState<ContentPath | null>(null);
  const assetPickerTriggerRef = useRef<HTMLButtonElement | null>(null);

  function update(path: ContentPath, value: unknown) {
    onContentChange(updateContentAtPath(content, [locale, ...path], value));
  }

  function field(path: ContentPath, label: string, value: string, long = false) {
    const exactPath = [locale, ...path].join(".");
    const error = validation.fieldErrors[exactPath];
    const inputId = pathId(exactPath);
    const errorId = `${inputId}-error`;
    const commonProps = {
      id: inputId,
      value,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errorId : undefined,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(path, event.target.value),
    };

    return (
      <label key={exactPath} className={styles.homeField} htmlFor={inputId}>
        <span>{label}</span>
        {long ? <textarea {...commonProps} rows={4} /> : <input {...commonProps} type="text" />}
        <FieldError id={errorId} path={exactPath} message={error} />
      </label>
    );
  }

  function imageField(path: ContentPath, value: string) {
    return (
      <div className={styles.assetFieldControl}>
        {field(path, "图片路径或 URL", value)}
        <button type="button" className={styles.secondaryButton} onClick={(event) => { assetPickerTriggerRef.current = event.currentTarget; setAssetPath(path); }}>
          <ImageIcon size={17} />选择媒体
        </button>
      </div>
    );
  }

  function scalarFields(sectionId: keyof LocalizedSiteContent, fields: ScalarField[]) {
    const values = localized[sectionId] as unknown as Record<string, string>;
    return fields.map(({ key, label, long }) => field([sectionId, key], label, values[key], long));
  }

  function updateCollection(path: ContentPath, items: unknown[], index: number, action: "add" | "remove" | "up" | "down", blank: unknown) {
    const next = [...items];
    if (action === "add") next.splice(index + 1, 0, blank);
    if (action === "remove") next.splice(index, 1);
    if (action === "up" && index > 0) [next[index - 1], next[index]] = [next[index], next[index - 1]];
    if (action === "down" && index < next.length - 1) [next[index], next[index + 1]] = [next[index + 1], next[index]];
    update(path, next);
  }

  function controls(path: ContentPath, items: unknown[], index: number, label: string, blank: unknown, minimum = 1) {
    return (
      <CollectionControls
        label={label}
        index={index}
        count={items.length}
        minimum={minimum}
        onAdd={() => updateCollection(path, items, index, "add", blank)}
        onRemove={() => updateCollection(path, items, index, "remove", blank)}
        onMoveUp={() => updateCollection(path, items, index, "up", blank)}
        onMoveDown={() => updateCollection(path, items, index, "down", blank)}
      />
    );
  }

  function renderSimpleSection() {
    if (section === "meta" || section === "nav" || section === "hero" || section === "works") {
      return scalarFields(section, SCALAR_FIELDS[section]);
    }
    return null;
  }

  function renderAbout() {
    const about = localized.about;
    return (
      <>
        {scalarFields("about", ABOUT_SCALARS.slice(0, 1))}
        <div className={styles.tupleFields}>
          {field(["about", "heading", 0], "标题第一段", about.heading[0])}
          {field(["about", "heading", 1], "标题第二段", about.heading[1])}
        </div>
        {scalarFields("about", ABOUT_SCALARS.slice(1, 2))}
        <div className={styles.collectionBlock}>
          <h3>介绍段落</h3>
          {about.paragraphs.map((paragraph, index) => (
            <div className={styles.collectionItem} key={`paragraph-${index}`}>
              {field(["about", "paragraphs", index], `段落 ${index + 1}`, paragraph, true)}
              {controls(["about", "paragraphs"], about.paragraphs, index, "段落", "")}
            </div>
          ))}
        </div>
        <div className={styles.collectionBlock}>
          <h3>数据</h3>
          {about.stats.map((stat, index) => (
            <div className={styles.collectionItem} key={`stat-${index}`}>
              <div className={styles.tripleFields}>
                {field(["about", "stats", index, "value"], "数值", stat.value)}
                {field(["about", "stats", index, "accent"], "强调文本", stat.accent)}
                {field(["about", "stats", index, "label"], "标签", stat.label)}
              </div>
              {controls(["about", "stats"], about.stats, index, "数据项", { value: "", accent: "", label: "" })}
            </div>
          ))}
        </div>
        {scalarFields("about", ABOUT_SCALARS.slice(2, 4))}
        <div className={styles.collectionBlock}>
          <h3>技能</h3>
          {about.skills.map((skill, index) => (
            <div className={styles.collectionItem} key={`skill-${index}`}>
              {field(["about", "skills", index], `技能 ${index + 1}`, skill)}
              {controls(["about", "skills"], about.skills, index, "技能", "")}
            </div>
          ))}
        </div>
        {scalarFields("about", ABOUT_SCALARS.slice(4))}
      </>
    );
  }

  function renderServices() {
    const services = localized.services;
    return (
      <>
        {scalarFields("services", SERVICE_SCALARS)}
        <div className={styles.collectionBlock}>
          <h3>服务项目</h3>
          {services.items.map((item, index) => (
            <div className={styles.collectionItem} key={`service-${index}`}>
              <div className={styles.tupleFields}>
                {field(["services", "items", index, 0], "服务名称", item[0])}
                {field(["services", "items", index, 1], "服务描述", item[1], true)}
              </div>
              {controls(["services", "items"], services.items, index, "服务项", ["", ""])}
            </div>
          ))}
        </div>
      </>
    );
  }

  function renderFooter() {
    const footer = localized.footer;
    return (
      <>
        {scalarFields("footer", FOOTER_SCALARS.slice(0, 2))}
        <div className={styles.tupleFields}>
          {field(["footer", "heading", 0], "标题第一段", footer.heading[0])}
          {field(["footer", "heading", 1], "标题第二段", footer.heading[1])}
        </div>
        {scalarFields("footer", FOOTER_SCALARS.slice(2, 6))}
        <div className={styles.collectionBlock}>
          <h3>页脚链接</h3>
          {footer.links.map((link, index) => (
            <div className={styles.collectionItem} key={`footer-link-${index}`}>
              {field(["footer", "links", index], `链接 ${index + 1}`, link)}
              {controls(["footer", "links"], footer.links, index, "页脚链接", "")}
            </div>
          ))}
        </div>
        {scalarFields("footer", FOOTER_SCALARS.slice(6))}
      </>
    );
  }

  function renderProjects() {
    const projects = localized.projects;
    const blankProject = { image: "", category: "", title: "", description: "", tags: [""] as string[], alt: "" };

    if (projects.length === 0) {
      return (
        <div className={styles.emptyProjects}>
          <p>当前语言还没有项目。</p>
          <button type="button" className={styles.secondaryButton} onClick={() => update(["projects"], [blankProject])}>
            <Plus size={17} />添加项目
          </button>
        </div>
      );
    }

    return projects.map((project, projectIndex) => (
      <article className={styles.projectEditor} key={`project-${projectIndex}`}>
        <div className={styles.collectionHeading}>
          <h3>项目 {projectIndex + 1}</h3>
          {controls(["projects"], projects, projectIndex, "项目", blankProject, 0)}
        </div>
        <div className={styles.tupleFields}>
          {field(["projects", projectIndex, "title"], "项目标题", project.title)}
          {field(["projects", projectIndex, "category"], "项目类别", project.category)}
        </div>
        {field(["projects", projectIndex, "description"], "项目描述", project.description, true)}
        <div className={styles.tupleFields}>
          {imageField(["projects", projectIndex, "image"], project.image)}
          {field(["projects", projectIndex, "alt"], "图片替代文本", project.alt)}
        </div>
        <div className={styles.collectionBlock}>
          <h3>项目标签</h3>
          {project.tags.map((tag, tagIndex) => (
            <div className={styles.collectionItem} key={`project-${projectIndex}-tag-${tagIndex}`}>
              {field(["projects", projectIndex, "tags", tagIndex], `标签 ${tagIndex + 1}`, tag)}
              {controls(["projects", projectIndex, "tags"], project.tags, tagIndex, "项目标签", "")}
            </div>
          ))}
        </div>
      </article>
    ));
  }

  return (
    <div className={styles.homeEditor}>
      <div className={styles.languageSwitch} role="group" aria-label="编辑语言">
        <button type="button" aria-pressed={locale === "zh"} onClick={() => onLocaleChange("zh")}>中文</button>
        <button type="button" aria-pressed={locale === "en"} onClick={() => onLocaleChange("en")}>English</button>
      </div>
      <div className={styles.homeEditorLayout}>
        <nav className={styles.sectionRail} aria-label="主页内容分区">
          {HOME_SECTION_DEFINITIONS.map(({ id, label }) => {
            const count = validation.sectionErrorCounts[`${locale}.${id}`] ?? 0;
            return (
              <button key={id} type="button" aria-current={section === id ? "page" : undefined} onClick={() => onSectionChange(id)}>
                <span>{label}</span>
                {count > 0 ? <strong aria-label={`${count} 个问题`}>{count}</strong> : null}
              </button>
            );
          })}
        </nav>
        <section className={styles.homeFormSurface} aria-labelledby={`homepage-section-${section}`}>
          <div className={styles.homeFormHeading}>
            <span className={styles.kicker}>{locale === "zh" ? "中文" : "ENGLISH"}</span>
            <h2 id={`homepage-section-${section}`}>{HOME_SECTION_DEFINITIONS.find((item) => item.id === section)?.label}</h2>
          </div>
          <div className={styles.homeFormGrid}>
            {renderSimpleSection()}
            {section === "about" ? renderAbout() : null}
            {section === "services" ? renderServices() : null}
            {section === "footer" ? renderFooter() : null}
            {section === "projects" ? renderProjects() : null}
          </div>
        </section>
      </div>
      <AssetPicker
        assets={assets}
        open={Boolean(assetPath)}
        triggerRef={assetPickerTriggerRef}
        onClose={() => setAssetPath(null)}
        onSelect={(asset) => {
          if (assetPath) update(assetPath, `/api/assets/${asset.id}`);
          setAssetPath(null);
        }}
      />
    </div>
  );
}
