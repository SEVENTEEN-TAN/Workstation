# UI 差异与验收覆盖清单（2026-09-30）

## 清点范围

在 `11cff68013298a031bd2c2185e13c42c19848e9f` 对比 `f0723cfca51e9c287c61a7f4cdf92be3940a5822`，`src/app/admin`、`src/components/admin`、`src/components/public` 与 `src/app/globals.css` 共 43 个差异文件。本轮另有 `KnowledgeWorkspace.tsx` 的选择生命周期修复。清点不表示这 43 个文件已完成逐项代码审查，更不表示整个分支已审查完毕。

| 模块 | 对应差异文件 | 已有实际证据 | 本轮核查及剩余边界 |
| --- | --- | --- | --- |
| 首页编辑与公开组件（18） | `HomeWorkspace.tsx`；`home/` 下 Editor、VisualWorkspace、content-editor、visual-editor-protocol；公开 About、Footer、Hero、HomeExperience、HomeJourney、HomeVisualEditor、Navbar、RecentWorks、Services、i18n、visual-editing；preview page、globals.css | [手机原位编辑](../2026-09-29-f2-mobile-partial/README.md)、[项目同步](../2026-09-23-stage-3c/README.md)、[新输入保留](../2026-09-30-save-concurrency/README.md)、[服务操作互斥](../2026-10-01-home-operation-order/README.md)、[公开静态差异审查](public-static-review.md) | 关键编辑/保存链路已有证据；主代理已核对公开组件及全局 CSS 静态差异。真实系统 IME、各组件组合交互、中间宽度和静态图片策略仍开放。恢复模态期间输入未证明。 |
| 三类草稿及辅助状态（5） | WeeklyActivity、OkrMilestoneDraft、CareerTimelineDraft 工作区，weekly-editor-state、workspace-utils | [转换定位](../2026-09-23-stage-3b/README.md)、[保存/失败重试/生成](../2026-09-30-save-concurrency/README.md) | 已验主要并发保护；周报完整导航/刷新矩阵仍归 F2。 |
| 公开条件提示（6） | CareerActivities、ExperienceRecords、PortfolioProjects、ResumeFiles、SkillAreas 工作区及 `okr/PublicReadiness.tsx` | [六页桌面/手机呈现](../2026-09-30-readiness-ui/README.md)、[项目同步](../2026-09-23-stage-3c/README.md)、[前台入口](../2026-09-23-stage-3b/README.md) | 主代理阅读这六个文件的分支差异，核对提示调用、span 结构和样式换行。本轮 12 页实际覆盖阻断/未上传状态、42 个入口滚动可达；未覆盖所有满足条件状态或 CRUD。 |
| OKR 工作区与弹窗（5） | ActionItemList、ObjectiveWorkspace、OkrCycleListWorkspace、OkrCycleWorkspace、OkrEntityDialog | [创建/编辑/短屏/焦点](../2026-09-23-stage-3b/README.md)、[列表阻断提示](../2026-09-30-readiness-ui/README.md) | 本轮列表桌面/手机可读，桌面“进入周期”外观较紧，入口未裁切且可达；不据此要求改样式。新增重复行动交互完整矩阵、父子工作区差异审查仍需核对。 |
| 仪表盘（2） | overview page、OverviewWorkspace | [四类队列和直达](../2026-09-29-stage-4-e1/README.md) | 装配与父级结束过滤已局部审查；不把当时未保存的截图当成当前截图文件。 |
| 知识库（2） | knowledge page、KnowledgeWorkspace | [笔记切换](../2026-09-30-save-concurrency/README.md)、[选库及扫描刷新](../2026-09-30-knowledge-vault-selection/README.md) | 选库四项 GREEN；扫描元数据、读取失败重试、笔记移除及迟到扫描四项已补验。发布/下架、附件选择、扫描与同步审查写入交错仍缺专项证据。 |
| 转换目标路由（1） | activities page | [目标切换与异常](../2026-09-23-stage-3b/README.md) | 已有同页面目标变化、目标缺失与异常转换证据。 |
| 后台外壳（2） | workspace layout、AdminShell | [手机导航](../2026-09-29-f2-mobile-partial/README.md)、[六页头像](../2026-09-30-readiness-ui/README.md) | 主代理核对 AdminShell 差异中的来源 key、错误回退及初始失败检查；12 个可见头像实际加载。本轮没有重验失败回退或完整键盘路径。 |
| 初始化（1） | SetupForm | [原生 POST](../2026-09-23-stage-3c/README.md) | 主代理核对当前分支仅增加 `method="post"`，不把此项扩大为完整初始化流程重验。 |
| 共享后台样式（1） | admin.module.css | 上述首页、队列、弹窗及六页截图 | 主代理核对新增队列、首页三栏/手机页签、readiness 与周报提示；workspaceTabs 仅由首页使用。当前呈现证据不覆盖每条 CSS 在所有宽度、空状态和主题下的效果。 |

## 下一批可继续的本地核查

1. 知识库扫描、创建发布草稿、附件选择、发布/下架与同步审查的并发和失败状态；当前选择生命周期测试不覆盖这些操作。
2. 公开组件与全局 CSS 的组合交互浏览器矩阵，以及重复行动在目标工作区中的真实交互证据；公开组件静态差异已核查，见 public-static-review.md。
3. 所有满足公开条件状态及完整技能证据/简历文件提示的呈现（当前六页检查只覆盖阻断状态）。

发布范围、服务器预检、生产迁移/旧版本回滚兼容性、备份与 Linux 构建仍需按部署门槛处理；本清单不构成合并或部署授权。C1–C5 待范围确认，F2/F4 保持未勾选。
