# HomePage Retirement Readiness

验收日期：2026-09-16

验收分支：`chore/homepage-retirement-audit`

基线提交：`6b2e6c7`

## 结论

WorkStation 已满足独立运行、数据保真、资源保真和桌面/手机视觉回归要求。源码、测试、脚本及正式部署文档不依赖独立 HomePage 项目。独立目录 `C:\Users\23399\Desktop\sqtan\HomePage` 未删除；归档或删除仍是单独的破坏性操作，需要另行确认。

本次验收只更新代码仓库和验证材料，不代表后续提交已经部署到生产服务器。

## 独立安装与数据库

- 使用新建 SQLite 文件执行了全部 8 个 Prisma 迁移。
- 同一数据库连续执行两次 `npm run db:seed`。
- 最终只有 1 个 `PUBLISHED` `SiteVersion`，管理员数量为 0。
- 已发布内容通过 `siteContentSchema` 完整校验。
- Windows 本地验收发现：完全不存在的 SQLite 文件需要先创建，再执行 `prisma migrate deploy`。`docs/deployment.md` 已将首次创建持久化数据库文件写入正式发布步骤。
- 本地相对 SQLite URL 在 Prisma CLI 与运行时客户端之间存在解析基准差异，验收因此全程改用同一物理文件的绝对 URL；生产 `.env` 本来就使用绝对持久化路径。

## 内容与资源基线

迁移基线：`data/backups/2026-09-15T20-00-22-412Z`

- `homepage-baseline.json` 中已发布版本为 1，草稿版本为 2。
- 基线已发布内容与 `bootstrapSiteContent` 深度序列化结果完全一致。
- 中英文均保留 4 个项目，顺序为 `neon-system`、`analog-archive`、`signal-editorial`、`vertical-habitat`。
- 基线数据库资产元数据为 0 条，页面图片来自 `public/images`。
- 当前 8 个图片文件与基线文件的 SHA-256 完全一致：

| 文件 | SHA-256 |
| --- | --- |
| `projects/analog-archive.webp` | `45DFB20F376A622EC3D7A4E26CB940351580DF2DBC138BAF7F69FF4BA7E17076` |
| `projects/neon-system.webp` | `05028EE6D59EC023607E894765CBD4BB0E437E7F9F009B02E295CD246A8C3905` |
| `projects/signal-editorial.webp` | `03830E428F346521EAE7FF588E416D28E2578AAF5C12EE4A560D5561A46E440F` |
| `projects/vertical-habitat.webp` | `BAEE4F681305EBE18DFFF381B8991894995250927AFEB73616009A05A9700FEC` |
| `wechat-qr.png` | `A3856AAC79FF3E21508EA5268659B97AA3A692770FBEF2211BA6EA5914E37C23` |
| `zedian-portrait-v2.png` | `EBE9E06649D5F40E87A9A5E0FC9540CCF0FB1CA918BB31ECDE353E410D3B7204` |
| `zedian-portrait-v3.png` | `EE5C4624382B1F6AC3ECA8E48C533DC038D0660AF326A25722C7E0C066E09F24` |
| `zedian-portrait.webp` | `5AFDE127C2EC7A4229A7025FD4DEFF1F196B5B714B4B8D08F0EC9D01D279DE67` |

## 自动化检查

| 检查 | 结果 |
| --- | --- |
| `npm test` | 25 个测试文件、170 项测试通过 |
| `npm run lint` | 通过 |
| `npm run db:validate` | 显式设置验收数据库 URL 后通过 |
| `npx tsc --noEmit` | 通过 |
| `npm run build` | Next.js 16.3.5 生产构建通过，32 个静态页面生成完成 |
| `tests/homepage-retirement.test.ts` | 2 项通过：禁止兄弟项目依赖、bootstrap 图片均存在 |

隔离工作区没有复制被 Git 忽略的 `.env`，因此第一次裸跑 `db:validate` 正确报告缺少 `DATABASE_URL`；设置与生产结构一致的显式数据库 URL 后校验通过。

## 视觉回归

对照文件：

- `homepage-desktop.png`：`1440×1100`
- `homepage-mobile.png`：`390×844`

使用生产构建启动本地服务，分别设置相同视口，等待入场动画稳定，并逐段滚动触发视口动画。检查了首屏、关于、项目、技术栈和联系区，同时切换至英文以匹配截图基线。

结果：布局层级、文字换行、图片比例、项目顺序、导航、语言切换、滚动动画和响应式行为未发现回归；手机端没有文字或控件重叠；浏览器错误及警告日志为 0。动态动画使逐像素截图不具备稳定性，因此本次采用同尺寸逐段视觉比较，并以内容深度相等和全部图片哈希相等作为确定性补充证据。

## 部署与回滚边界

`docs/deployment.md` 只描述 WorkStation 的 Next.js standalone、持久化 SQLite/上传目录、备份、迁移、原子切流、健康检查及匹配版本回滚。部署前仍必须复核服务器实时状态；本报告不声称生产环境已更新。

