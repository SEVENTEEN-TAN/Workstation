# Real Homepage Visual Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/admin/home` 建成首页专用三栏可视化编辑器，在真实首页渲染中修改受控文字，并从设置面板修改链接和图片，同时保留现有草稿、发布、历史及高级表单边界。

**Architecture:** `HomeWorkspace` 继续单点持有工作副本和发布动作；无后台壳的认证 iframe 复用 `HomeExperience` 及正式首页的公开业务数据装配。父子页面只通过同源、来源窗口校验和字段 allowlist 的消息协议通信，编辑态结构校验允许临时无效文字，严格 `siteContentSchema` 仍是保存和发布门槛。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript 5.9、Zod 4、Vitest 4、CSS Modules、原生 iframe／`postMessage`／`contentEditable`；不新增依赖。

**Spec:** `docs/superpowers/specs/2026-09-22-homepage-real-visual-editor-design.md`

## Global Constraints

- 只实施 B1–B9；不实施 C1–C5、知识库入口、独立简历入口、重复行动或仪表盘待办中心。
- 保持唯一的双语 `SiteVersion.content` 快照，不新增数据库表、区块模型或第二套持久化。
- 正式页与编辑预览只复用 `HomeExperience`；不得复制首页组件或公开数据过滤规则。
- iframe 路由继续认证，但不得经过 `(workspace)` 的 `AdminShell` 布局。
- 只保存纯文本和 schema 允许的设置值；不保存 HTML、CSS、脚本、DOM 或任意对象路径。
- 人物图和二维码只能使用 `/images/...` 或 `/api/assets/{id}`；不新增远程图片 URL。
- 动态、能力、经历、简历状态和项目资料在画布中只读，仍由各自后台模块维护。
- 未保存编辑只存在于父页面工作副本；保存进入草稿，明确发布后才影响正式首页和后台品牌图。
- 高级字段表单始终保留，并补齐邮箱、GitHub、人物图和二维码设置。
- 当前执行范围允许完成后推送 `feat/homepage-visual-editor`；不合并、不部署。

## Review Focus

1. iframe 在有未保存修改时重载或重新 ready，必须收到最新工作副本；旧窗口或其他同源窗口的消息不能修改内容。由 Task 3 的协议测试和 Task 8 的重载验收固定。
2. 中文输入法组合输入、纯文本粘贴和失焦提交不能产生半个字符、HTML 或丢失输入。由 Task 4 的提交辅助函数测试和 Task 8 的中文浏览器验收固定。
3. 临时空文字和未完成链接必须继续显示并阻止保存；脚本协议、任意图片路径和未知字段始终不可执行。由 Task 2、Task 3 的 schema／协议测试固定。
4. 已选择项目后来被删除、设为私密或变得不完整时，编辑预览不得崩溃或伪造新卡片，服务端保存仍须拒绝。由 Task 5 的项目物化测试固定。
5. iframe 加载失败和品牌图片请求失败时，分别保留高级表单与 `17` 回退，不产生空白工作区。由 Task 6、Task 7 的契约测试和 Task 8 的故障验收固定。

---

### Task 1: 真实首页数据装配与无后台壳预览路由

**Files:**
- Modify: `src/lib/services/public-resume.ts:75-85`
- Delete: `src/app/admin/(workspace)/home/visual-preview/page.tsx`
- Create: `src/app/admin/(preview)/home/visual-preview/page.tsx`
- Modify: `src/components/public/HomeVisualEditor.tsx:9-37`
- Test: `tests/public-resume.test.ts`
- Test: `tests/homepage-composition.test.ts`
- Test: `tests/admin-ui-contracts.test.ts:696-768`

**Interfaces:**
- Produces: `getPublicResumeDataForContent(content: SiteContent): Promise<PublicResumeData>`.
- Produces: `HomeVisualEditor({ initialData }: { initialData: PublicResumeData })`.
- Preserves: `getPublicResumeData(): Promise<PublicResumeData | null>` for the public homepage and resume page.

- [ ] **Step 1: Write failing tests for draft-content injection, full homepage composition, and route placement**

Add a service assertion that an injected snapshot is returned with the same public evidence, render `HomeVisualEditor` from a complete `PublicResumeData` fixture, and assert that only the shell-free route exists:

```ts
import { existsSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeVisualEditor } from "../src/components/public/HomeVisualEditor";
import type { PublicResumeData } from "../src/lib/services/public-resume";

const previewData = {
  content: bootstrapSiteContent,
  activities: [{
    id: "activity-preview",
    titleZh: "预览动态",
    titleEn: "Preview activity",
    summaryZh: "只读公开动态",
    summaryEn: "Read-only public activity",
    occurredAt: "2026-09-22T00:00:00.000Z",
    visibility: "PUBLIC",
    featured: true,
    linkUrl: null,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  }],
  projects: [],
  skills: [],
  experiences: [],
  downloads: { zh: true, en: false },
} satisfies PublicResumeData;

const markup = renderToStaticMarkup(createElement(HomeVisualEditor, { initialData: previewData }));
expect(markup).toContain("Preview activity");
expect(markup).toContain('id="now"');

expect(existsSync(resolve(projectRoot, "src/app/admin/(workspace)/home/visual-preview/page.tsx"))).toBe(false);
expect(existsSync(resolve(projectRoot, "src/app/admin/(preview)/home/visual-preview/page.tsx"))).toBe(true);
```

In `tests/homepage-composition.test.ts`, also change `sectionPositions` to `identity`, `about`, `now`, `work`, `capability`, `journey`, `contact` so the existing order test covers the full rendered page. In `tests/public-resume.test.ts`, extend the existing `createPublicResumeService` fixture with a draft snapshot whose title differs from `bootstrapSiteContent`, then assert `data?.content` is exactly the injected draft while private resume metadata remains absent.

- [ ] **Step 2: Run the focused tests and verify the expected failures**

Run:

```powershell
npm test -- tests/public-resume.test.ts tests/homepage-composition.test.ts tests/admin-ui-contracts.test.ts
```

Expected: FAIL because `HomeVisualEditor` still accepts `initialContent`, the new route does not exist, and the old route still exists.

- [ ] **Step 3: Share the default evidence loaders and add the content-specific entrypoint**

Refactor only the default wiring in `public-resume.ts`; retain `createPublicResumeService` unchanged:

```ts
async function getDefaultPublicResumeData(loadSiteContent: PublicResumeSources["loadSiteContent"]) {
  const resumeFiles = await getResumeFileService();
  return createPublicResumeService({
    loadSiteContent,
    loadExperiences: () => experienceRecordService.listPublic(),
    loadProjects: () => portfolioProjectService.listPublic(),
    loadSkills: () => skillCapabilityService.listPublic(),
    loadActivities: () => careerActivityService.listPublic(),
    loadResumeFiles: () => resumeFiles.list(),
  }).getData();
}

export function getPublicResumeData() {
  return getDefaultPublicResumeData(getPublishedSiteContent);
}

export async function getPublicResumeDataForContent(content: SiteContent): Promise<PublicResumeData> {
  const data = await getDefaultPublicResumeData(async () => content);
  if (!data) throw new Error("首页预览内容不可用");
  return data;
}
```

- [ ] **Step 4: Move the preview route and render the complete data shape**

Create the route at the exact new path and remove the old file:

```tsx
import { redirect } from "next/navigation";

import { HomeVisualEditor } from "@/components/public/HomeVisualEditor";
import { currentSession } from "@/lib/auth/session";
import { getPublicResumeDataForContent } from "@/lib/services/public-resume";
import { getSiteContentService } from "@/lib/services/site-content";

export const dynamic = "force-dynamic";

export default async function HomeVisualPreviewPage() {
  const session = await currentSession();
  if (!session) redirect("/admin/login");
  const draft = await (await getSiteContentService()).getOrCreateDraft(session.userId);
  return <HomeVisualEditor initialData={await getPublicResumeDataForContent(draft.content)} />;
}
```

Update `HomeVisualEditor` to keep `initialData.content` in state and pass all five render inputs:

```tsx
return <HomeExperience
  content={content}
  activities={initialData.activities}
  skills={initialData.skills}
  experiences={initialData.experiences}
  resumeDownloads={initialData.downloads}
  editor
/>;
```

- [ ] **Step 5: Run the focused tests and commit**

Run:

```powershell
npm test -- tests/public-resume.test.ts tests/homepage-composition.test.ts tests/admin-ui-contracts.test.ts
git diff --check
```

Expected: all named tests PASS and `git diff --check` exits 0.

Commit:

```powershell
git add -- src/lib/services/public-resume.ts src/app/admin src/components/public/HomeVisualEditor.tsx tests/public-resume.test.ts tests/homepage-composition.test.ts tests/admin-ui-contracts.test.ts
git commit -m "feat: render real homepage in visual preview"
```

### Task 2: 编辑态结构 schema 与精确字段注册表

**Files:**
- Modify: `src/lib/content/schema.ts:3-132`
- Modify: `src/components/admin/home/visual-editor-protocol.ts:1-62`
- Modify: `src/components/admin/home/content-editor.ts:62-65`
- Test: `tests/site-content-schema.test.ts`
- Test: `tests/home-visual-editor.test.ts`
- Test: `tests/home-content-editor.test.ts`

**Interfaces:**
- Produces: `siteContentEditingSchema`, whose output remains assignable to `SiteContent` but permits temporary empty copy and unfinished email/GitHub strings.
- Produces: `getVisualEditFields(content: SiteContent): readonly VisualEditField[]`.
- Produces: `getVisualEditField(content: SiteContent, path: unknown): VisualEditField | null`.
- Produces: `HomepageImagePath = "settings.portraitImage" | "settings.wechatQrImage"`.
- Preserves: `updateVisualContent(content, path, value)`; it now authorizes against `getVisualEditField`.

- [ ] **Step 1: Write failing schema and registry tests**

Add these cases with a parsed copy of `bootstrapSiteContent`:

```ts
const editing = structuredClone(bootstrapSiteContent);
editing.en.hero.lineOne = "";
editing.settings.githubUrl = "https://";

expect(siteContentEditingSchema.safeParse(editing).success).toBe(true);
expect(siteContentSchema.safeParse(editing).success).toBe(false);
expect(siteContentEditingSchema.safeParse({
  ...editing,
  settings: { ...editing.settings, portraitImage: "javascript:alert(1)" },
}).success).toBe(false);

const paragraphPath = `en.about.paragraphs.${editing.en.about.paragraphs.length - 1}`;
expect(getVisualEditField(editing, paragraphPath)?.kind).toBe("text");
expect(getVisualEditField(editing, "en.services.items.0.1")?.section).toBe("capability");
expect(getVisualEditField(editing, "settings.portraitImage")).toMatchObject({
  kind: "image",
  altPaths: { zh: "zh.hero.portraitAlt", en: "en.hero.portraitAlt" },
});
expect(getVisualEditField(editing, "activities.0.titleEn")).toBeNull();
expect(getVisualEditField(editing, "__proto__.polluted")).toBeNull();
```

Add an `updateVisualContent` assertion that a current collection index updates immutably and an out-of-range index throws `/editable/i`.

- [ ] **Step 2: Run the focused tests and verify missing exports fail**

Run:

```powershell
npm test -- tests/site-content-schema.test.ts tests/home-visual-editor.test.ts tests/home-content-editor.test.ts
```

Expected: FAIL because `siteContentEditingSchema` and the content-aware registry functions do not exist.

- [ ] **Step 3: Build strict and editing schemas from one field-shape factory**

In `schema.ts`, keep the current key lists but replace module-level `text`, `textList`, `heading`, localized section schemas, and root schema with factories parameterized by a text field and settings schema:

```ts
const editingText = z.string().max(10_000);
const savedText = z.string().trim().min(1).max(10_000);

export const homepageEmailSchema = z.string().trim().min(1).max(10_000).email();
export const homepageGithubUrlSchema = z.string().trim().min(1).max(10_000).url().refine(
  (value) => new URL(value).protocol === "https:",
  "GitHub 地址必须使用 HTTPS",
);

const editingSettingsSchema = z.object({
  portraitImage: homepageImagePathSchema,
  wechatQrImage: homepageImagePathSchema,
  email: editingText,
  githubUrl: editingText,
}).default(DEFAULT_HOMEPAGE_SETTINGS);

const savedSettingsSchema = z.object({
  portraitImage: homepageImagePathSchema,
  wechatQrImage: homepageImagePathSchema,
  email: homepageEmailSchema,
  githubUrl: homepageGithubUrlSchema,
}).default(DEFAULT_HOMEPAGE_SETTINGS);

function buildLocalizedSiteContentSchema(textField: z.ZodString) {
  const textList = z.array(textField).min(1);
  const heading = z.tuple([textField, textField]);
  return z.object({
    meta: z.object({ title: textField, description: textField }),
    nav: z.object({
      brand: textField, about: textField, work: textField, contact: textField,
      top: textField, goContact: textField, switchLanguage: textField, switchLabel: textField,
    }),
    hero: z.object({
      backdrop: textField, role: textField, lineOne: textField, lineTwo: textField,
      headingLabel: textField, intro: textField, work: textField, contact: textField,
      badgeArea: textField, badgeLabel: textField, portraitAlt: textField,
      badgeRole: textField, active: textField,
    }),
    about: z.object({
      eyebrow: textField, heading, headingLabel: textField, paragraphs: textList,
      stats: z.array(z.object({ value: textField, accent: textField, label: textField })).min(1),
      toolkit: textField, skillCount: textField, skills: textList, quote: textField,
    }),
    works: z.object({
      eyebrow: textField, heading: textField, viewAll: textField, explore: textField,
      navigation: textField, project: textField, showProject: textField,
    }),
    services: z.object({
      eyebrow: textField, headingStart: textField, headingOutline: textField,
      headingLabel: textField, items: z.array(z.tuple([textField, textField])).min(1),
    }),
    footer: z.object({
      backdrop: textField, eyebrow: textField, heading, headingLabel: textField,
      intro: textField, menu: textField, socials: textField, links: textList,
      github: textField, wechat: textField, wechatHint: textField,
      wechatAlt: textField, copyright: textField, privacy: textField, terms: textField,
    }),
    projects: z.array(z.object({
      slug: textField.optional(), image: z.string(), category: textField,
      title: textField, description: textField, tags: textList, alt: textField,
    })),
  });
}

function buildSiteContentSchema<
  TLocalized extends z.ZodType,
  TSettings extends z.ZodType,
>(
  localized: TLocalized,
  settingsSchema: TSettings,
) {
  return z.object({
    selectedProjectIds: z.array(savedText)
      .refine((ids) => new Set(ids).size === ids.length, "主页项目不能重复")
      .optional(),
    settings: settingsSchema,
    en: localized,
    zh: localized,
  });
}

const localizedSiteContentEditingSchema = buildLocalizedSiteContentSchema(editingText);
export const localizedSiteContentSchema = buildLocalizedSiteContentSchema(savedText);
export const siteContentEditingSchema = buildSiteContentSchema(
  localizedSiteContentEditingSchema,
  editingSettingsSchema,
);
export const siteContentSchema = buildSiteContentSchema(
  localizedSiteContentSchema,
  savedSettingsSchema,
);

export type LocalizedSiteContent = z.infer<typeof localizedSiteContentSchema>;
export type SiteContent = z.infer<typeof siteContentSchema>;
```

Preserve both existing exported types: `LocalizedSiteContent` stays inferred from the strict localized schema and `SiteContent` stays inferred from strict `siteContentSchema`. Existing fixtures and imports must compile unchanged.

- [ ] **Step 4: Make the registry enumerate only concrete current paths**

Extend `VisualEditField`:

```ts
export type VisualEditSection = "identity" | "about" | "work" | "capability" | "contact";

export type VisualEditField = {
  path: string;
  kind: "text" | "link" | "image";
  label: string;
  section: VisualEditSection;
  altPaths?: { zh: string; en: string };
};

export type HomepageImagePath = "settings.portraitImage" | "settings.wechatQrImage";
```

Replace the fixed tuples with this explicit supported-field list, then generate collection paths from current content. Accessibility-only copy such as `headingLabel`, `badgeArea`, `badgeLabel`, `navigation`, `project`, `showProject`, and `wechatHint` remains in the complete field editor rather than pretending to be visible inline copy:

```ts
const FIXED_LOCALIZED_FIELDS = [
  ["nav.brand", "导航品牌", "identity"],
  ["nav.about", "导航关于", "identity"],
  ["nav.work", "导航作品", "identity"],
  ["nav.contact", "导航联系", "identity"],
  ["hero.backdrop", "首屏背景字", "identity"],
  ["hero.role", "首屏职位", "identity"],
  ["hero.lineOne", "首屏标题第一行", "identity"],
  ["hero.lineTwo", "首屏标题第二行", "identity"],
  ["hero.intro", "首屏介绍", "identity"],
  ["hero.work", "作品按钮", "identity"],
  ["hero.contact", "联系按钮", "identity"],
  ["hero.badgeRole", "人物卡职位", "identity"],
  ["hero.active", "人物卡状态", "identity"],
  ["about.eyebrow", "关于眉题", "about"],
  ["about.heading.0", "关于标题第一行", "about"],
  ["about.heading.1", "关于标题第二行", "about"],
  ["about.toolkit", "工具箱标题", "about"],
  ["about.skillCount", "技能数量", "about"],
  ["about.quote", "关于引语", "about"],
  ["works.eyebrow", "作品眉题", "work"],
  ["works.heading", "作品标题", "work"],
  ["works.viewAll", "查看全部", "work"],
  ["works.explore", "浏览项目", "work"],
  ["services.eyebrow", "能力眉题", "capability"],
  ["services.headingStart", "能力标题", "capability"],
  ["services.headingOutline", "能力标题强调", "capability"],
  ["footer.backdrop", "联系背景字", "contact"],
  ["footer.eyebrow", "联系眉题", "contact"],
  ["footer.heading.0", "联系标题第一行", "contact"],
  ["footer.heading.1", "联系标题第二行", "contact"],
  ["footer.intro", "联系介绍", "contact"],
  ["footer.menu", "菜单标题", "contact"],
  ["footer.socials", "社交标题", "contact"],
  ["footer.github", "GitHub 标签", "contact"],
  ["footer.wechat", "微信标签", "contact"],
  ["footer.copyright", "版权文字", "contact"],
  ["footer.privacy", "隐私文字", "contact"],
  ["footer.terms", "条款文字", "contact"],
] as const;

function fixedLocalizedFields(locale: "zh" | "en"): VisualEditField[] {
  const prefix = locale.toUpperCase();
  return FIXED_LOCALIZED_FIELDS.map(([path, label, section]) => ({
    path: `${locale}.${path}`,
    kind: "text",
    label: `${prefix} · ${label}`,
    section,
  }));
}

function localizedCollectionFields(content: SiteContent, locale: "zh" | "en"): VisualEditField[] {
  const copy = content[locale];
  const prefix = locale.toUpperCase();
  return [
    ...copy.about.paragraphs.map((_, index) => ({
      path: `${locale}.about.paragraphs.${index}`, kind: "text" as const,
      label: `${prefix} · 关于段落 ${index + 1}`, section: "about" as const,
    })),
    ...copy.about.stats.flatMap((_, index) => (["value", "accent", "label"] as const).map((key) => ({
      path: `${locale}.about.stats.${index}.${key}`, kind: "text" as const,
      label: `${prefix} · 关于数据 ${index + 1} ${key}`, section: "about" as const,
    }))),
    ...copy.about.skills.map((_, index) => ({
      path: `${locale}.about.skills.${index}`, kind: "text" as const,
      label: `${prefix} · 技能 ${index + 1}`, section: "about" as const,
    })),
    ...copy.services.items.flatMap((_, index) => ([0, 1] as const).map((part) => ({
      path: `${locale}.services.items.${index}.${part}`, kind: "text" as const,
      label: `${prefix} · 服务 ${index + 1} ${part === 0 ? "名称" : "说明"}`,
      section: "capability" as const,
    }))),
    ...copy.footer.links.map((_, index) => ({
      path: `${locale}.footer.links.${index}`, kind: "text" as const,
      label: `${prefix} · 页脚菜单 ${index + 1}`, section: "contact" as const,
    })),
  ];
}

export function getVisualEditFields(content: SiteContent): readonly VisualEditField[] {
  return [
    ...fixedLocalizedFields("zh"),
    ...localizedCollectionFields(content, "zh"),
    ...fixedLocalizedFields("en"),
    ...localizedCollectionFields(content, "en"),
    { path: "settings.email", kind: "link", label: "联系邮箱", section: "contact" },
    { path: "settings.githubUrl", kind: "link", label: "GitHub 地址", section: "contact" },
    { path: "settings.portraitImage", kind: "image", label: "人物肖像", section: "identity", altPaths: { zh: "zh.hero.portraitAlt", en: "en.hero.portraitAlt" } },
    { path: "settings.wechatQrImage", kind: "image", label: "微信二维码", section: "contact", altPaths: { zh: "zh.footer.wechatAlt", en: "en.footer.wechatAlt" } },
  ];
}

export function getVisualEditField(content: SiteContent, path: unknown) {
  if (typeof path !== "string") return null;
  return getVisualEditFields(content).find((field) => field.path === path) ?? null;
}
```

Do not retain fixed `about.paragraphs.0` and `.1` entries because the collection generator owns every current paragraph index. Image alternative text remains reachable through the complete field editor via the image field's `altPaths`; it is not a second inline marker on the image.

- [ ] **Step 5: Authorize visual updates against the current content and rerun tests**

Change `updateVisualContent` to use `getVisualEditField(content, path)` and retain immutable `updateContentAtPath`:

```ts
export function updateVisualContent(content: SiteContent, path: string, value: string): SiteContent {
  if (!getVisualEditField(content, path)) throw new Error("Field is not editable");
  return updateContentAtPath(content, path.split("."), value);
}
```

Run:

```powershell
npm test -- tests/site-content-schema.test.ts tests/home-visual-editor.test.ts tests/home-content-editor.test.ts
npx tsc --noEmit
git diff --check
```

Expected: all named tests PASS, TypeScript exits 0, and no whitespace errors.

Commit:

```powershell
git add -- src/lib/content/schema.ts src/components/admin/home/visual-editor-protocol.ts src/components/admin/home/content-editor.ts tests/site-content-schema.test.ts tests/home-visual-editor.test.ts tests/home-content-editor.test.ts
git commit -m "feat: separate homepage editing validation"
```

### Task 3: 安全消息协议、语言同步与 iframe 重载生命周期

**Files:**
- Modify: `src/components/admin/home/visual-editor-protocol.ts`
- Modify: `src/components/admin/HomeWorkspace.tsx:32-65`
- Modify: `src/components/public/HomeVisualEditor.tsx`
- Modify: `src/components/public/HomeExperience.tsx:16-42`
- Modify: `src/components/public/i18n.tsx:11-53`
- Test: `tests/home-visual-editor.test.ts`
- Test: `tests/admin-ui-contracts.test.ts:696-768`

**Interfaces:**
- Consumes: `siteContentEditingSchema` and `getVisualEditField(content, path)` from Task 2.
- Produces: `EditorPreviewState = { content: SiteContent; locale: SiteLocale; selectedPath: string | null }`.
- Produces: `isTrustedEditorMessage(event, expectedOrigin, expectedSource): boolean`.
- Produces: `sendEditorPreviewState(target, origin, state): void`, used for every ready replay and subsequent state change.
- Produces parent messages `homepage-editor:content` and `homepage-editor:focus`.
- Produces iframe messages `ready`, `select`, `commit`, and `locale`.
- Extends `HomeExperience` with optional controlled `locale` and `onLocaleChange` without changing public callers.

- [ ] **Step 1: Write failing protocol tests for temporary values, origin/source, and complete message variants**

```ts
const expectedSource = {} as MessageEventSource;
const foreignSource = {} as MessageEventSource;

expect(isTrustedEditorMessage(
  { origin: "https://sqtan.test", source: expectedSource },
  "https://sqtan.test",
  expectedSource,
)).toBe(true);
expect(isTrustedEditorMessage(
  { origin: "https://sqtan.test", source: foreignSource },
  "https://sqtan.test",
  expectedSource,
)).toBe(false);
expect(isTrustedEditorMessage(
  { origin: "https://sqtan.test", source: null },
  "https://sqtan.test",
  null,
)).toBe(false);
expect(isTrustedEditorMessage(
  { origin: "https://other.test", source: expectedSource },
  "https://sqtan.test",
  expectedSource,
)).toBe(false);

const temporary = structuredClone(bootstrapSiteContent);
temporary.en.hero.lineOne = "";
expect(parseParentMessage({
  type: "homepage-editor:content",
  content: temporary,
  locale: "en",
  selectedPath: "en.hero.lineOne",
})).toMatchObject({ type: "homepage-editor:content", locale: "en" });
expect(parseParentMessage({
  type: "homepage-editor:content",
  content: temporary,
  locale: "en",
  selectedPath: "en.about.paragraphs.999",
})).toMatchObject({ type: "homepage-editor:content", selectedPath: null });
expect(parseIframeMessage({
  type: "homepage-editor:commit",
  path: "en.hero.lineOne",
  value: "Java < AI",
}, temporary)).toMatchObject({ value: "Java < AI" });
expect(parseIframeMessage({
  type: "homepage-editor:commit",
  path: "en.hero.lineOne",
  value: "x".repeat(10_001),
}, temporary)).toBeNull();
```

Also assert `homepage-editor:focus` accepts only `identity`, `about`, `now`, `work`, `capability`, `journey`, and `contact`, and locale messages accept only `zh` or `en`.

- [ ] **Step 2: Run tests and verify the new protocol surface is missing**

Run:

```powershell
npm test -- tests/home-visual-editor.test.ts tests/admin-ui-contracts.test.ts
```

Expected: FAIL on missing `isTrustedEditorMessage`, `parseParentMessage`, locale/focus variants, and the current rejection of angle brackets.

- [ ] **Step 3: Implement discriminated messages and trust checks**

In `visual-editor-protocol.ts`:

```ts
export const HOME_PREVIEW_SECTIONS = [
  "identity", "about", "now", "work", "capability", "journey", "contact",
] as const;
export type HomePreviewSection = (typeof HOME_PREVIEW_SECTIONS)[number];
export type EditorPreviewState = {
  content: SiteContent;
  locale: "zh" | "en";
  selectedPath: string | null;
};

export function isTrustedEditorMessage(
  event: Pick<MessageEvent, "origin" | "source">,
  expectedOrigin: string,
  expectedSource: MessageEventSource | null,
) {
  return expectedSource !== null
    && event.origin === expectedOrigin
    && event.source === expectedSource;
}

type EditorMessageTarget = {
  postMessage(message: unknown, targetOrigin: string): void;
};

export function sendEditorPreviewState(
  target: EditorMessageTarget,
  origin: string,
  state: EditorPreviewState,
) {
  target.postMessage({ type: "homepage-editor:content", ...state }, origin);
}
```

Parse `content` through `siteContentEditingSchema`. If `selectedPath` is null or registered in the parsed content, keep it; if a former collection item disappeared, normalize the stale path to null so valid new content is not discarded. Reject non-string/non-null selection payloads. Parse commits with `getVisualEditField(content, path)` and a 10,000-character string limit. Do not reject `<` or `>` because commits are applied as `textContent`, not HTML. Keep image and link values out of iframe commits; those are parent-panel changes.

- [ ] **Step 4: Make locale controlled only when the editor supplies it**

Extend `I18nProvider`:

```tsx
const activeLocale = controlledLocale ?? locale;
const changeLocale = (next: Locale) => {
  if (controlledLocale === undefined) setLocale(next);
  onLocaleChange?.(next);
};

const value = useMemo(() => ({
  locale: activeLocale,
  setLocale: changeLocale,
  copy: content[activeLocale],
  settings: content.settings,
  editor,
}), [activeLocale, content, editor, onLocaleChange]);
```

Add optional `locale?: Locale` and `onLocaleChange?: (locale: Locale) => void` props to `HomeExperience` and pass them to `I18nProvider`. The hydration effect reads localStorage only when `controlledLocale === undefined`; the title, description, document language, and persistence effect uses `activeLocale`. Existing public callers omit both and retain localStorage behavior.

- [ ] **Step 5: Make every ready event send the latest parent state directly**

In `HomeWorkspace`, keep latest values in refs and use a status union instead of a ready boolean:

```tsx
const contentRef = useRef(content);
const localeRef = useRef<SiteLocale>("zh");
const selectedPathRef = useRef<string | null>(null);
const [previewStatus, setPreviewStatus] = useState<"loading" | "ready" | "error">("loading");

contentRef.current = content;

function sendPreviewState() {
  const target = visualPreviewRef.current?.contentWindow;
  if (!target) return;
  sendEditorPreviewState(target, window.location.origin, {
    content: contentRef.current,
    locale: localeRef.current,
    selectedPath: selectedPathRef.current,
  });
}
```

The message listener must first call `isTrustedEditorMessage(event, window.location.origin, visualPreviewRef.current?.contentWindow ?? null)`. On every valid `ready`, clear the current timeout, set status to ready, and call `sendPreviewState()` immediately. On iframe `load`, clear an older timer, set status to loading, and start one 10-second timer that changes only a still-loading preview to error. Clear the timer on unmount. Changes to content, locale, or selection call the same sender while ready. `parseIframeMessage(event.data, contentRef.current)` authorizes commits against the latest content.

Use one locale-change function for both the parent toolbar and iframe `locale` messages. Settings paths remain selected; a localized path maps from `zh.`/`en.` to the same registered path under the next locale, or clears if the counterpart no longer exists:

```tsx
function changePreviewLocale(nextLocale: SiteLocale) {
  setPreviewLocale(nextLocale);
  setSelectedPath((current) => {
    if (!current || (!current.startsWith("zh.") && !current.startsWith("en."))) return current;
    const counterpart = `${nextLocale}.${current.slice(3)}`;
    return getVisualEditField(contentRef.current, counterpart)?.path ?? null;
  });
}
```

- [ ] **Step 6: Enforce parent source in the iframe and restore the latest state after reload**

`HomeVisualEditor` must validate `event.source === window.parent`, parse content through the editing schema, hold locale/selection state, and report locale changes:

```tsx
function receiveParentMessage(event: MessageEvent) {
  if (!isTrustedEditorMessage(event, window.location.origin, window.parent)) return;
  const message = parseParentMessage(event.data);
  if (!message) return;
  if (message.type === "homepage-editor:content") {
    setContent(message.content);
    setLocale(message.locale);
    setSelectedPath(message.selectedPath);
  }
  if (message.type === "homepage-editor:focus") {
    document.getElementById(message.section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
```

Pass controlled locale to `HomeExperience`; post `{ type: "homepage-editor:locale", locale: next }` when the page switch changes it.

- [ ] **Step 7: Run focused tests, type-check, and commit**

Run:

```powershell
npm test -- tests/home-visual-editor.test.ts tests/admin-ui-contracts.test.ts tests/homepage-composition.test.ts
npx tsc --noEmit
git diff --check
```

Expected: all named tests PASS, TypeScript exits 0, and diff check exits 0.

Commit:

```powershell
git add -- src/components/admin/HomeWorkspace.tsx src/components/admin/home/visual-editor-protocol.ts src/components/public/HomeVisualEditor.tsx src/components/public/HomeExperience.tsx src/components/public/i18n.tsx tests/home-visual-editor.test.ts tests/admin-ui-contracts.test.ts tests/homepage-composition.test.ts
git commit -m "feat: harden homepage preview synchronization"
```

### Task 4: 全页面纯文字原位编辑与链接／图片选择

**Files:**
- Create: `src/components/public/visual-editing.ts`
- Modify: `src/components/public/HomeVisualEditor.tsx`
- Modify: `src/components/public/Navbar.tsx`
- Modify: `src/components/public/Hero.tsx:13-80`
- Modify: `src/components/public/About.tsx:10-44`
- Modify: `src/components/public/RecentWorks.tsx:12-61`
- Modify: `src/components/public/Services.tsx:10-29`
- Modify: `src/components/public/Footer.tsx:13-28`
- Modify: `src/app/globals.css`
- Test: `tests/home-visual-editor.test.ts`
- Test: `tests/homepage-composition.test.ts`

**Interfaces:**
- Consumes: content-aware registry and message types from Tasks 2–3.
- Produces: `editableTextProps(enabled, path)` and `selectableFieldProps(enabled, path)`; both omit editor attributes when disabled, and the latter is shared by link targets and images.
- Produces: `createTextCommit(content, path, text, composing)` and `safeEditorLinkTarget(kind, value)` as pure, directly tested interaction helpers.
- Produces: iframe delegated selection, navigation interception, composition-safe blur commits, and plain-text paste.

- [ ] **Step 1: Write failing render tests for every editable public section and public-mode isolation**

Render `HomeExperience` once with `editor` and once without it. The editor markup must contain representative paths from every CMS-owned section:

```ts
for (const path of [
  "en.nav.brand",
  "en.hero.work",
  "settings.portraitImage",
  "en.about.heading.0",
  "en.about.stats.0.value",
  "en.works.heading",
  "en.services.items.0.1",
  "en.footer.github",
  "settings.email",
  "settings.githubUrl",
  "settings.wechatQrImage",
]) {
  expect(editorMarkup).toContain(`data-cms-path="${path}"`);
  expect(publicMarkup).not.toContain(`data-cms-path="${path}"`);
}
expect(editorMarkup).not.toContain('data-cms-path="activities.');
expect(editorMarkup).not.toContain('data-cms-path="experiences.');
```

Add pure tests for `editableTextProps(false, path)` and `selectableFieldProps(false, path)` both returning `{}`. Their enabled forms must contain the exact path and `tabIndex: 0`; only the text form contains `contentEditable` and `suppressContentEditableWarning`, while the selectable form contains `role: "button"`.

Add exact IME and destination tests:

```ts
expect(createTextCommit(bootstrapSiteContent, "en.hero.lineOne", "中文输入", true)).toBeNull();
expect(createTextCommit(bootstrapSiteContent, "en.hero.lineOne", "中文输入", false)).toEqual({
  type: "homepage-editor:commit",
  path: "en.hero.lineOne",
  value: "中文输入",
});
expect(safeEditorLinkTarget("github", "javascript:alert(1)")).toBeUndefined();
expect(safeEditorLinkTarget("github", "https://github.com/SEVENTEEN-TAN")).toBe("https://github.com/SEVENTEEN-TAN");
```

- [ ] **Step 2: Run tests and verify non-Hero markers are absent**

Run:

```powershell
npm test -- tests/home-visual-editor.test.ts tests/homepage-composition.test.ts
```

Expected: FAIL because only four Hero fields currently have markers and helper functions do not exist.

- [ ] **Step 3: Add minimal editor-only attribute helpers**

```ts
export function editableTextProps(enabled: boolean, path: string) {
  return enabled ? {
    "data-cms-path": path,
    contentEditable: true,
    suppressContentEditableWarning: true,
    tabIndex: 0,
  } as const : {};
}

export function selectableFieldProps(enabled: boolean, path: string) {
  return enabled ? {
    "data-cms-path": path,
    tabIndex: 0,
    role: "button" as const,
  } : {};
}

export function createTextCommit(
  content: SiteContent,
  path: unknown,
  value: string,
  composing: boolean,
) {
  const field = getVisualEditField(content, path);
  if (composing || !field || field.kind !== "text" || value.length > 10_000) return null;
  return { type: "homepage-editor:commit" as const, path: field.path, value };
}

export function safeEditorLinkTarget(kind: "email" | "github", value: string) {
  if (kind === "email") {
    const parsed = homepageEmailSchema.safeParse(value);
    return parsed.success ? `mailto:${parsed.data}` : undefined;
  }
  const parsed = homepageGithubUrlSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
```

Use `useI18n()`’s `editor` and `locale` in each public component. Apply markers exactly as follows so implementation and review agree on coverage:

- `Navbar`: `nav.brand`, `nav.about`, `nav.work`, and `nav.contact`; keep the language-switch label in the complete field editor so the preview's own language control remains usable.
- `Hero`: `hero.backdrop`, `role`, `lineOne`, `lineTwo`, `intro`, `work`, `contact`, `badgeRole`, `active`, plus `settings.portraitImage` on the portrait image.
- `About`: `about.eyebrow`, both `heading` entries, every paragraph, all three values of every stat, `toolkit`, `skillCount`, every skill, and `quote`.
- `RecentWorks`: `works.eyebrow`, `heading`, `viewAll`, and `explore`; materialized project-card fields remain read-only.
- Fallback `Services`: `services.eyebrow`, `headingStart`, `headingOutline`, and both tuple entries of every item. Structured capability records remain read-only.
- `Footer`: `footer.backdrop`, `eyebrow`, both `heading` entries, `intro`, `menu`, `socials`, every `links` entry, `github`, `wechat`, `copyright`, `privacy`, `terms`, plus `settings.email`, `settings.githubUrl`, and `settings.wechatQrImage` as selectable non-text fields.

When a button or link also contains an icon or fixed punctuation, add one inline `<span>` around only the editable label and mark that span; never make the entire interactive element content-editable. Put `settings.githubUrl` on the outer GitHub anchor and `footer.github` on its inner label span, so clicking the icon selects the target while focusing the label edits its copy. Put `settings.email` on the email anchor because its visible value and destination are one setting. Apply `selectableFieldProps` to both images. In Hero, disable card dragging while `editor` is true and make the card pointer-interactive so desktop and mobile previews can select the portrait reliably. In Footer, use `safeEditorLinkTarget` for editor-mode email and GitHub `href` values; public mode continues to use the already strict saved settings.

- [ ] **Step 4: Implement delegated selection, navigation interception, IME guard, and text-only commit**

In `HomeVisualEditor`, keep the current content available to handlers without reinstalling them, then use document-level handlers installed once:

```tsx
const contentRef = useRef(content);
contentRef.current = content;
```

Resolve the nearest `[data-cms-path]`, look it up with `getVisualEditField(contentRef.current, path)`, and post `select` on click or focus. Prevent default on anchors and form submissions while editor mode is active. In `Navbar`, `Hero`, `Services`, and `Footer`, any existing button action that wraps an editable label must return without scrolling or toggling when `editor` is true and the event target is inside `[data-cms-path][contenteditable="true"]`; clicking its non-editable icon/padding may keep the original action. The unmarked language switch remains usable. Only fields with `kind === "text"` may post `commit`.

Track composition and normalize paste without `innerHTML`:

```ts
const composing = useRef(false);

function insertPlainText(text: string) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  selection.deleteFromDocument();
  const range = selection.getRangeAt(0);
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function commitTarget(target: HTMLElement) {
  const path = target.dataset.cmsPath;
  const message = createTextCommit(
    contentRef.current,
    path,
    target.textContent ?? "",
    composing.current,
  );
  if (message) window.parent.postMessage(message, window.location.origin);
}
```

On `paste`, prevent default only for registered text fields and call `insertPlainText(event.clipboardData?.getData("text/plain") ?? "")`. On `compositionstart` set true, on `compositionend` set false, and on `focusout` call `commitTarget` in a queued microtask so the final composed text is available.

- [ ] **Step 5: Add editor-only visual affordances without changing public rendering**

Add global selectors scoped to the iframe editor marker:

```css
[data-cms-path] {
  position: relative;
}

[data-homepage-editor="true"] [data-cms-path]:hover,
[data-homepage-editor="true"] [data-cms-path]:focus-visible,
[data-homepage-editor="true"] [data-cms-selected="true"] {
  outline: 2px solid #00df8f;
  outline-offset: 4px;
}
```

Set `data-homepage-editor="true"` on the `HomeExperience` root only when `editor` is true. In `HomeVisualEditor`, react to `selectedPath` by removing `data-cms-selected` from the previous element and setting it on the element whose `dataset.cmsPath` exactly equals the current path; do not build a CSS selector from the untrusted path. Remove the attribute during cleanup. Neither editor attribute may appear on the public homepage.

- [ ] **Step 6: Run focused tests, type-check, and commit**

Run:

```powershell
npm test -- tests/home-visual-editor.test.ts tests/homepage-composition.test.ts
npx tsc --noEmit
npm run lint
git diff --check
```

Expected: tests, TypeScript, ESLint, and diff check all pass.

Commit:

```powershell
git add -- src/components/public src/app/globals.css tests/home-visual-editor.test.ts tests/homepage-composition.test.ts
git commit -m "feat: edit homepage copy in rendered view"
```

### Task 5: 媒体设置、高级表单兜底与未保存项目预览

**Files:**
- Modify: `src/lib/content/homepage-projects.ts:1-44`
- Modify: `src/components/admin/home/content-editor.ts`
- Modify: `src/components/admin/home/HomepageEditor.tsx:159-181,523-553`
- Modify: `src/components/admin/HomeWorkspace.tsx`
- Test: `tests/homepage-projects.test.ts`
- Test: `tests/home-content-editor.test.ts`
- Test: `tests/admin-ui-contracts.test.ts:830-867`

**Interfaces:**
- Produces: `HomepageProjectCandidate`, accepting Date or ISO-string date fields without weakening project validation.
- Produces: `materializeHomepageProjectsForPreview(content, projects): SiteContent`, which returns current materialized cards unchanged when a selected source is unavailable.
- Produces: one parent-owned `AssetPicker` with target type `"settings.portraitImage" | "settings.wechatQrImage"`.
- Extends: `HomepageEditor` with `onRequestAsset(path, trigger: HTMLButtonElement)` and language-neutral settings inputs, matching the existing `AssetPicker` focus-return contract.

- [ ] **Step 1: Write failing tests for serializable project data and all four fallback settings**

In `tests/homepage-projects.test.ts`, build two valid `PortfolioProjectData` fixtures with ISO date strings and reverse their selected IDs:

```ts
const preview = materializeHomepageProjectsForPreview(
  { ...bootstrapSiteContent, selectedProjectIds: [second.id, first.id] },
  [first, second],
);
expect(preview.en.projects.map((project) => project.slug)).toEqual([second.slug, first.slug]);
expect(preview.zh.projects.map((project) => project.slug)).toEqual([second.slug, first.slug]);

const unavailable = materializeHomepageProjectsForPreview(
  { ...bootstrapSiteContent, selectedProjectIds: ["missing-project"] },
  [first],
);
expect(unavailable.en.projects).toEqual(bootstrapSiteContent.en.projects);
```

In `tests/admin-ui-contracts.test.ts`, require `HomeWorkspace` to render `AssetPicker`, pass `onRequestAsset` to `HomepageEditor`, and require the editor to expose `settings.email`, `settings.githubUrl`, `settings.portraitImage`, and `settings.wechatQrImage` rather than raw arbitrary image URL inputs.

- [ ] **Step 2: Run tests and verify serializable preview materialization and settings controls are missing**

Run:

```powershell
npm test -- tests/homepage-projects.test.ts tests/home-content-editor.test.ts tests/admin-ui-contracts.test.ts
```

Expected: FAIL because the preview helper and settings controls do not exist and `assets` remains unused.

- [ ] **Step 3: Generalize only the project input type needed by both server and browser**

In `homepage-projects.ts`:

```ts
export type HomepageProjectCandidate = Omit<
  PortfolioProjectInput,
  "startedAt" | "completedAt"
> & {
  id: string;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
};
```

Change `isSelectableProject`, `toLocalizedProject`, and `materializeHomepageProjects` to accept `HomepageProjectCandidate` / `HomepageProjectCandidate[]`, and remove the now-unused `PortfolioProjectRecord` import. Continue using `portfolioProjectInputSchema.safeParse(project)` plus `visibility === "PUBLIC"`; do not trust the looser date union without parsing. Add:

```ts
export function materializeHomepageProjectsForPreview(
  content: SiteContent,
  projects: HomepageProjectCandidate[],
): SiteContent {
  try {
    return materializeHomepageProjects(content, projects);
  } catch {
    return content;
  }
}
```

The service save path still calls strict `materializeHomepageProjects` and therefore still rejects missing, private, or incomplete sources.

- [ ] **Step 4: Derive iframe content from current project selection without changing dirty-state semantics**

In `HomeWorkspace`:

```tsx
const previewContent = useMemo(
  () => materializeHomepageProjectsForPreview(content, projects),
  [content, projects],
);
const previewContentRef = useRef(previewContent);
previewContentRef.current = previewContent;
```

Send `previewContentRef.current` to the iframe, but continue computing `dirty`, validation, save, and publish from the original `content`. A successful save still refetches the server-materialized draft.

- [ ] **Step 5: Mount one AssetPicker in the parent and route both image fields through it**

Destructure the existing `assets` prop in `HomeWorkspace`, import the existing `AssetPicker` from `./home/AssetPicker` and `HomepageImagePath` from `visual-editor-protocol.ts`, then add parent state and a typed request function:

```tsx
const [assetTarget, setAssetTarget] = useState<HomepageImagePath | null>(null);
const assetPickerTriggerRef = useRef<HTMLButtonElement | null>(null);

function requestAsset(path: HomepageImagePath, trigger: HTMLButtonElement) {
  assetPickerTriggerRef.current = trigger;
  setAssetTarget(path);
}
```

Render one `AssetPicker`. Its selection handler first returns when `assetTarget` is null; otherwise it calls `setContent(updateVisualContent(contentRef.current, assetTarget, `/api/assets/${asset.id}`))` and then `setAssetTarget(null)`. Its close handler only calls `setAssetTarget(null)`. This keeps cancellation side-effect free and preserves focus through the existing picker contract.

- [ ] **Step 6: Add language-neutral settings to the existing advanced editor**

Extend `HomepageEditorProps` with `onRequestAsset`. In the “个人与首屏” task show the current portrait and a “从媒体库替换人物图” button. In “联系与导航” show controlled email and GitHub inputs, the current QR image, and a “从媒体库替换二维码” button. Use exact validation paths:

```tsx
const emailError = validation.fieldErrors["settings.email"];
<input
  id="homepage-settings-email"
  value={content.settings.email}
  aria-invalid={emailError ? true : undefined}
  onChange={(event) => onContentChange(updateVisualContent(content, "settings.email", event.target.value))}
/>
```

Use the same pattern for `settings.githubUrl`. Image fields expose no free-form path input.

- [ ] **Step 7: Run focused tests, type-check, and commit**

Run:

```powershell
npm test -- tests/homepage-projects.test.ts tests/home-content-editor.test.ts tests/admin-ui-contracts.test.ts tests/admin-services.test.ts
npx tsc --noEmit
git diff --check
```

Expected: all named tests PASS; server save rejection tests remain green; TypeScript and diff check exit 0.

Commit:

```powershell
git add -- src/lib/content/homepage-projects.ts src/components/admin/HomeWorkspace.tsx src/components/admin/home/HomepageEditor.tsx src/components/admin/home/content-editor.ts tests/homepage-projects.test.ts tests/home-content-editor.test.ts tests/admin-ui-contracts.test.ts
git commit -m "feat: edit homepage media and preview projects"
```

### Task 6: 三栏可视化工作区、选中项设置和故障恢复

**Files:**
- Create: `src/components/admin/home/HomepageVisualWorkspace.tsx`
- Modify: `src/components/admin/HomeWorkspace.tsx:156-247`
- Modify: `src/app/admin/admin.module.css:1256-1473,2815-2907`
- Test: `tests/admin-ui-contracts.test.ts`
- Test: `tests/home-content-editor.test.ts`

**Interfaces:**
- Consumes: `EditorPreviewState`, `VisualEditField`, `getVisualEditField`, parent focus messages, `previewStatus`, and parent asset request from Tasks 2–5.
- Produces: `HomepageVisualWorkspace` with visual structure, desktop/mobile viewport, locale control, iframe, inspector, retry, and narrow-screen pane tabs.
- Changes `HomeWorkspace` view state to `"visual" | "fields" | "history"` without changing action-bar save/publish semantics.

- [ ] **Step 1: Write failing UI contract tests for three top-level views and three visual panes**

Render or inspect the real components and assert exact accessible labels:

```ts
for (const label of ["可视化编辑", "字段编辑", "发布记录"]) {
  expect(workspaceSource).toContain(label);
}
for (const label of ["页面结构", "真实首页预览", "选中项设置"]) {
  expect(visualWorkspaceSource).toContain(label);
}
expect(visualWorkspaceSource).toContain("桌面预览");
expect(visualWorkspaceSource).toContain("手机预览");
expect(visualWorkspaceSource).toContain("中文");
expect(visualWorkspaceSource).toContain("English");
expect(visualWorkspaceSource).toContain("重试预览");
expect(adminStyles).toMatch(/\.homeVisualLayout[\s\S]*grid-template-columns/);
expect(adminStyles).toMatch(/@media \(max-width: 899px\)[\s\S]*\.homeVisualPaneTabs/);
```

Add pure assertions for the exported structure list: `now`, `capability`, and `journey` must be `source: "business"` with `/admin/activities`, `/admin/skills`, and `/admin/experience`; `work` must be `source: "mixed"` with `/admin/projects`; `identity`, `about`, and `contact` must be `source: "snapshot"`.

- [ ] **Step 2: Run tests and verify the visual workspace is missing**

Run:

```powershell
npm test -- tests/admin-ui-contracts.test.ts tests/home-content-editor.test.ts
```

Expected: FAIL because `HomepageVisualWorkspace` and the three-view state do not exist.

- [ ] **Step 3: Implement the fixed homepage structure and typed props**

In the new file:

```ts
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
```

- [ ] **Step 4: Build the three panes and selected-field inspector**

The center iframe always uses `/admin/home/visual-preview`, `key={previewKey}`, and a class based only on device width. The left pane calls `onFocusSection`; label `snapshot` as “本页文案可编辑”, `business` as “来自业务模块”, and `mixed` as “本页文案 + 项目模块”. Every entry with `adminHref` renders that exact management link.

Keep narrow-screen pane selection local to this presentation component:

```tsx
const [activePane, setActivePane] = useState<"structure" | "preview" | "inspector">("preview");
```

Render a three-button `role="tablist"` with `aria-selected`, and set `data-mobile-active={activePane === paneId}` on each pane. Do not use the HTML `hidden` attribute: it would also hide inactive panes on desktop, where all three must remain visible.

For the inspector, resolve `getVisualEditField(content, selectedPath)`. Render:

- no selection: direct instructions and the `dirty`-derived saved/unsaved status;
- text: label, language/path, current validation message, and “请在页面原位编辑”；
- `settings.email` / `settings.githubUrl`: a controlled input updating `updateVisualContent`;
- image: current thumbnail, “替换图片” button calling `onRequestAsset`, and links to the appropriate Chinese/English alternative-text fields in the fallback form.

When `previewStatus === "error"`, keep the inspector and work-copy controls mounted and render both “重试预览” (`onRetryPreview`) and “转到字段编辑” (`onOpenFields`).

Do not add generic component property editors, arbitrary URL fields, CSS controls, block controls, or drag handles.

- [ ] **Step 5: Wire visual, fields, and history views into HomeWorkspace**

```tsx
const [view, setView] = useState<"visual" | "fields" | "history">("visual");
const [previewLocale, setPreviewLocale] = useState<SiteLocale>("zh");
const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
const [selectedPath, setSelectedPath] = useState<string | null>(null);
const [previewKey, setPreviewKey] = useState(0);
```

The retry action sets the preview back to loading, increments `previewKey`, and leaves `content` untouched. The visual view renders `HomepageVisualWorkspace` with `dirty={dirty}` and `onOpenFields={() => setView("fields")}`; the fields view renders the extended `HomepageEditor`; history remains the existing version list. Keep readiness summary and action bar above all three views.

- [ ] **Step 6: Add desktop three-column and narrow-screen pane-tab CSS**

Use one responsive grid and fixed preview widths:

```css
.homeVisualLayout {
  display: grid;
  grid-template-columns: minmax(170px, 0.55fr) minmax(480px, 2fr) minmax(230px, 0.8fr);
  gap: 16px;
  align-items: start;
}

.homeVisualPaneTabs { display: none; }

.homePreviewFrame[data-device="mobile"] {
  width: min(390px, 100%);
  margin-inline: auto;
}

@media (max-width: 899px) {
  .homeVisualLayout { grid-template-columns: minmax(0, 1fr); }
  .homeVisualPaneTabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .homeVisualPane[data-mobile-active="false"] { display: none; }
}
```

At desktop widths, hide pane tabs and show all panes. Do not alter the public homepage CSS.

- [ ] **Step 7: Verify preview failure keeps editing available**

Add a contract test that `previewStatus === "error"` renders both “重试预览” and a callback/button that selects the fields view. Ensure the iframe timeout never clears `content`, `savedContent`, validation, or dirty state.

Run:

```powershell
npm test -- tests/admin-ui-contracts.test.ts tests/home-content-editor.test.ts tests/home-visual-editor.test.ts
npx tsc --noEmit
npm run lint
git diff --check
```

Expected: all checks pass.

Commit:

```powershell
git add -- src/components/admin/HomeWorkspace.tsx src/components/admin/home/HomepageVisualWorkspace.tsx src/app/admin/admin.module.css tests/admin-ui-contracts.test.ts tests/home-content-editor.test.ts tests/home-visual-editor.test.ts
git commit -m "feat: add homepage visual editing workspace"
```

### Task 7: 已发布人物图的可靠后台品牌回退

**Files:**
- Modify: `src/components/admin/AdminShell.tsx:14-27`
- Test: `tests/admin-ui-contracts.test.ts:752-767`

**Interfaces:**
- Preserves: `AdminShell({ username, brandImage, children })`.
- Changes only: `BrandMark` renders the published image when loadable and `17` when absent or failed.

- [ ] **Step 1: Write a failing wiring contract for load-error fallback and prop recovery**

```ts
expect(shellSource).toContain("imageFailed");
expect(shellSource).toContain("onError");
expect(shellSource).toContain("key={brandImage}");
expect(shellSource).toContain('"17"');
```

The keyed child requirement proves every changed `brandImage` source gets a fresh failure state, including switching back to a source used earlier.

- [ ] **Step 2: Run the focused test and verify the onError path is absent**

Run:

```powershell
npm test -- tests/admin-ui-contracts.test.ts
```

Expected: FAIL on the new `imageFailed`, keyed source, and `onError` assertions.

- [ ] **Step 3: Implement the smallest source-keyed failure state**

```tsx
function BrandImage({ src }: { src: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (imageFailed) return <>17</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-full w-full rounded-[5px] object-cover"
      onError={() => setImageFailed(true)}
    />
  );
}

function BrandMark({ brandImage }: { brandImage?: string }) {
  return (
    <span className={styles.brandMark}>
      {brandImage ? <BrandImage key={brandImage} src={brandImage} /> : "17"}
    </span>
  );
}
```

Do not create another image field, thumbnail service, or upload control.

- [ ] **Step 4: Run the focused test, lint, and commit**

Run:

```powershell
npm test -- tests/admin-ui-contracts.test.ts
npm run lint
git diff --check
```

Expected: all checks pass.

Commit:

```powershell
git add -- src/components/admin/AdminShell.tsx tests/admin-ui-contracts.test.ts
git commit -m "fix: fall back when admin brand image fails"
```

### Task 8: 全量回归、浏览器验收与交付记录

**Files:**
- Modify: `tests/home-visual-editor.test.ts`
- Modify: `tests/home-content-editor.test.ts`
- Modify: `tests/admin-ui-contracts.test.ts`
- Modify: `docs/2026-09-22-functional-optimization-todo.md`
- Modify: `docs/2026-09-22-functional-plan-review.md`
- Modify: `docs/superpowers/plans/2026-09-22-homepage-real-visual-editor.md`

**Interfaces:**
- No new production interface.
- Produces: recorded automated and browser evidence for B1–B9, with local/branch/merge/deployment status kept separate.

- [ ] **Step 1: Add final regression cases for all five Review Focus items**

Add concrete integration assertions using the pure helpers created by the owning tasks:

```ts
it("serializes the latest unsaved state for every preview replay", () => {
  const postMessage = vi.fn();
  const latest = structuredClone(bootstrapSiteContent);
  latest.zh.hero.intro = "尚未保存的最新内容";
  sendEditorPreviewState({ postMessage }, "https://sqtan.test", {
    content: latest,
    locale: "zh",
    selectedPath: "zh.hero.intro",
  });
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ content: latest }), "https://sqtan.test");
});

it("commits complete Chinese text only after composition", () => {
  expect(createTextCommit(bootstrapSiteContent, "zh.hero.intro", "输入中", true)).toBeNull();
  expect(createTextCommit(bootstrapSiteContent, "zh.hero.intro", "输入完成", false))
    .toMatchObject({ value: "输入完成" });
});

it("keeps invalid editor destinations inert while strict save is blocked", () => {
  const invalid = structuredClone(bootstrapSiteContent);
  invalid.settings.githubUrl = "javascript:alert(1)";
  expect(safeEditorLinkTarget("github", invalid.settings.githubUrl)).toBeUndefined();
  expect(siteContentSchema.safeParse(invalid).success).toBe(false);
});

it("keeps saved project cards when a selected source is unavailable", () => {
  const content = { ...bootstrapSiteContent, selectedProjectIds: ["missing"] };
  expect(materializeHomepageProjectsForPreview(content, []).en.projects)
    .toEqual(bootstrapSiteContent.en.projects);
});

it("keeps field editing wired when preview loading fails", () => {
  const visualSource = readProjectFile("src/components/admin/home/HomepageVisualWorkspace.tsx");
  const workspaceSource = readProjectFile("src/components/admin/HomeWorkspace.tsx");
  expect(visualSource).toContain('previewStatus === "error"');
  expect(visualSource).toContain("重试预览");
  expect(visualSource).toContain("转到字段编辑");
  expect(visualSource).toContain("onOpenFields");
  expect(workspaceSource).toContain('setView("fields")');
});
```

Place the source-wiring failure test in `tests/admin-ui-contracts.test.ts`, where `readProjectFile` already exists; place the pure helper tests in the test files that import those helpers. Do not copy the file reader into another suite.

- [ ] **Step 2: Run the focused homepage suite**

Run:

```powershell
npm test -- tests/site-content-schema.test.ts tests/public-resume.test.ts tests/homepage-composition.test.ts tests/home-visual-editor.test.ts tests/home-content-editor.test.ts tests/homepage-projects.test.ts tests/admin-services.test.ts tests/admin-ui-contracts.test.ts
```

Expected: all named files PASS with zero skipped or failing tests.

- [ ] **Step 3: Run the repository-wide non-browser verification**

Run each command separately and record its exit code:

```powershell
npm test
npx tsc --noEmit
npm run lint
npm run db:validate
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 4: Run a production build against an isolated migrated SQLite database**

In the same PowerShell session:

```powershell
$stage2BuildHadDatabaseUrl = Test-Path Env:DATABASE_URL
$stage2BuildPreviousDatabaseUrl = $env:DATABASE_URL
$stage2BuildDb = Join-Path ([System.IO.Path]::GetTempPath()) ("workstation-stage2-build-" + [guid]::NewGuid().ToString("N") + ".db")
$env:DATABASE_URL = "file:" + $stage2BuildDb.Replace("\", "/")
npx prisma migrate deploy
npm run db:seed
npm run build
```

Expected: migration, seed, and production build exit 0. After confirming `$stage2BuildDb` resolves to a single file under `[System.IO.Path]::GetTempPath()`, remove only that file with `Remove-Item -LiteralPath $stage2BuildDb`. If `$stage2BuildHadDatabaseUrl` is true, restore `$env:DATABASE_URL = $stage2BuildPreviousDatabaseUrl`; otherwise remove only the process-scoped variable with `Remove-Item Env:DATABASE_URL`.

- [ ] **Step 5: Start an isolated browser-acceptance environment**

First confirm port 3017 is unused; stop if another process owns it:

```powershell
Get-NetTCPConnection -LocalPort 3017 -ErrorAction SilentlyContinue
```

Create a second temporary SQLite file, migrate and seed it, then run the app on port 3017:

```powershell
$stage2BrowserHadDatabaseUrl = Test-Path Env:DATABASE_URL
$stage2BrowserPreviousDatabaseUrl = $env:DATABASE_URL
$stage2BrowserDb = Join-Path ([System.IO.Path]::GetTempPath()) ("workstation-stage2-browser-" + [guid]::NewGuid().ToString("N") + ".db")
$env:DATABASE_URL = "file:" + $stage2BrowserDb.Replace("\", "/")
npx prisma migrate deploy
npm run db:seed
npm run dev -- --port 3017
```

Create a temporary administrator through `http://localhost:3017/admin/setup`; do not record the password in the plan, terminal output, screenshots, commits, or memory.

- [ ] **Step 6: Execute and record the B1–B9 browser matrix**

Verify each item with the rendered UI:

1. Desktop and 390px mobile preview show `identity → about → now → work → capability → journey → contact` without an `AdminShell` inside the iframe.
2. Edit one Chinese and one English heading, paragraph, button, and link label; switch language with a field selected and confirm the inspector maps to its same-language counterpart; use a Chinese IME and paste styled text, then confirm only plain text persists.
3. Enter an incomplete GitHub/email value: input remains visible, preview link is inert, save is disabled, and the exact field error is shown; restore a valid value.
4. Select and cancel portrait replacement, then select an image; repeat for QR and confirm both alternative-text entries remain editable.
5. With unsaved text present, switch language, desktop/mobile, visual/field views, then reload and retry the iframe; the working copy remains.
6. Change project selection/order and confirm the unsaved preview updates; make a selected source unavailable in the isolated data and confirm preview fallback plus save rejection.
7. Save the draft and open the separate saved preview: changes appear there while the public `/` remains unchanged; publish and confirm `/` updates.
8. Restore an older version and confirm it becomes a draft only; publish explicitly to change `/`.
9. Block the published portrait request in the isolated browser session and confirm both desktop sidebar and mobile header show `17`; then remove the block and change the source to confirm a new image is attempted.
10. Invalidate the preview session or block its load and confirm “重试预览” plus field editing remain available with the current input.

Capture concise textual evidence and screenshots for desktop visual editor, mobile visual editor, link/image inspector, preview failure fallback, and post-publish public page. Screenshots must not contain credentials or private records.

- [ ] **Step 7: Stop the temporary server and clean only task-created artifacts**

Stop the development process through its own terminal session. Resolve `$stage2BrowserDb`, verify it is a single file under `[System.IO.Path]::GetTempPath()`, then run `Remove-Item -LiteralPath $stage2BrowserDb`. If `$stage2BrowserHadDatabaseUrl` is true, restore `$env:DATABASE_URL = $stage2BrowserPreviousDatabaseUrl`; otherwise remove only the process-scoped variable. Do not stop unrelated Node processes or delete broad directories.

- [ ] **Step 8: Update delivery documents from evidence, not intent**

In the TODO file:

- mark B1–B9 complete only when their mapped automated and browser evidence passed;
- leave F2 unchecked if any matrix item remains unverified and list the exact remaining cases;
- state “功能分支完成” separately from merge, deployment, and live verification.

In the plan and review summary, record exact test counts, command exit status, browser cases, commit hashes, remote SHA after push, and any remaining manual acceptance. Do not claim merged, deployed, or online.

- [ ] **Step 9: Review the complete diff and commit delivery evidence**

Run:

```powershell
git status --short
git diff --check
git diff --stat
git diff -- src tests docs
```

Confirm every changed line traces to B1–B9 or their tests/docs and no secrets, generated database, `.env`, screenshot containing private data, or unrelated formatting is present.

Commit:

```powershell
git add -- tests/home-visual-editor.test.ts tests/home-content-editor.test.ts tests/admin-ui-contracts.test.ts docs/2026-09-22-functional-optimization-todo.md docs/2026-09-22-functional-plan-review.md docs/superpowers/plans/2026-09-22-homepage-real-visual-editor.md
git commit -m "test: verify real homepage visual editor"
```

- [ ] **Step 10: Push the feature branch and verify the remote commit**

```powershell
git push origin feat/homepage-visual-editor
git rev-parse HEAD
git rev-parse origin/feat/homepage-visual-editor
git status --short --branch
```

Expected: local and remote SHA match and the worktree is clean. Stop here: do not merge or deploy.

## Plan Self-Review

- Spec coverage: Tasks 1–7 implement real composition, route isolation, validation separation, safe lifecycle, field registry, direct text editing, link/image inspector, project preview, advanced fallback, three-column UX, responsive tabs, and brand fallback. Task 8 covers every B1–B9 acceptance path and delivery-state separation.
- Placeholders: none; every task names exact files, interfaces, failing tests, implementation behavior, commands, expected results, and commit boundaries.
- Type consistency: `SiteContent` remains the strict persisted output; `siteContentEditingSchema` validates transient messages; `EditorPreviewState`, `SiteLocale`, `HomepageImagePath`, `HomepageProjectCandidate`, and `HomePreviewSection` are introduced once and consumed by later tasks under the same names.
- Review Focus: iframe replay/source, IME/plain text, invalid destinations, stale project sources, and preview/brand failure each have an owning task test plus a Task 8 browser check.
- Scope: one homepage subsystem, eight sequentially dependent deliverables, no database migration and no generic page-builder capability.
