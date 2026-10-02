# UI 差异与验收覆盖清单（2026-09-30）

## 清点范围

在 `11cff68013298a031bd2c2185e13c42c19848e9f` 对比 `f0723cfca51e9c287c61a7f4cdf92be3940a5822`，`src/app/admin`、`src/components/admin`、`src/components/public` 与 `src/app/globals.css` 共 43 个差异文件。本轮另有 `KnowledgeWorkspace.tsx` 的选择生命周期修复。清点不表示这 43 个文件已完成逐项代码审查，更不表示整个分支已审查完毕。

| 模块 | 对应差异文件 | 已有实际证据 | 本轮核查及剩余边界 |
| --- | --- | --- | --- |
| 首页编辑与公开组件（18） | `HomeWorkspace.tsx`；`home/` 下 Editor、VisualWorkspace、content-editor、visual-editor-protocol；公开 About、Footer、Hero、HomeExperience、HomeJourney、HomeVisualEditor、Navbar、RecentWorks、Services、i18n、visual-editing；preview page、globals.css | [手机原位编辑](../2026-09-29-f2-mobile-partial/README.md)、[项目同步](../2026-09-23-stage-3c/README.md)、[新输入保留](../2026-09-30-save-concurrency/README.md)、[服务操作互斥](../2026-10-01-home-operation-order/README.md)、[公开静态差异审查](public-static-review.md) | 关键编辑/保存链路已有证据；主代理已核对公开组件及全局 CSS 静态差异。[公开导航专项](../2026-09-30-public-interaction/README.md)补验中英文7宽度及键盘/触屏/语言/QR共24组，修复640px英文越界。真实系统IME、公开编辑器/其他组件组合交互、路由实际点击和静态图片策略仍开放。恢复模态期间输入未证明。 |
| 三类草稿及辅助状态（5，本轮新增历史追踪 helper 和根布局接线） | WeeklyActivity、OkrMilestoneDraft、CareerTimelineDraft 工作区，weekly-editor-state、workspace-utils；WeeklyHistoryTracker、root layout | [转换定位](../2026-09-23-stage-3b/README.md)、[保存/失败重试/生成](../2026-09-30-save-concurrency/README.md)、[周报导航/刷新](../2026-09-30-weekly-navigation/README.md)、[实际保存边界](../2026-09-30-weekly-save-boundaries/README.md) | 周报27组实际Edge检查含原生刷新、Back/Forward、跨多条历史、375px、存储失败、能力禁用、旧条目刷新、未知锚点往返、多标签409恢复、pending保存失败/冲突及副本清理失败/手动回退输入；18项真实HTTP并发/回滚断言独立重跑通过。只给周报增加离开保护，根布局helper保留Next state并记录位置。有原生位置的旧条目可准确恢复；无能力且位置未知（包括新旧锚点）时保留编辑器，明确保存/取消后才继续导航，地址栏可能已移动。已配置真实AI候选、其他浏览器/真实手机、所有旧历史/片段组合、快速交错仍归F2/F4；存储删除异常及pending保存失败/409现已实际补验。 |
| 公开条件提示（6） | CareerActivities、ExperienceRecords、PortfolioProjects、ResumeFiles、SkillAreas 工作区及 `okr/PublicReadiness.tsx` | [阻断状态](../2026-09-30-readiness-ui/README.md)、[满足条件样例](../2026-09-30-readiness-positive/README.md)、[项目同步](../2026-09-23-stage-3c/README.md)、[前台入口](../2026-09-23-stage-3b/README.md) | 主代理阅读六文件差异；阻断/未上传 12 页、42 入口已有证据，满足条件另 12 页/14 组提示/60 入口和双语 PDF 字节下载已由主代理独立重跑通过。项目及文章两类技能证据为 DB/API 样例；未覆盖所有证据组合、上传、CRUD 或公开页渲染。 |
| OKR 工作区与弹窗（5） | ActionItemList、ObjectiveWorkspace、OkrCycleListWorkspace、OkrCycleWorkspace、OkrEntityDialog | [创建/编辑/短屏/焦点](../2026-09-23-stage-3b/README.md)、[列表阻断提示](../2026-09-30-readiness-ui/README.md)、[重复行动工作区](../2026-09-30-recurrence-workspace/README.md) | 桌面每日、375px 每周样例通过实际表单和完成/删除操作，12 组断言含字段继承、重复完成/重开/删除不再生成、KR 进度不变及仪表盘定位；主代理独立重跑通过。桌面“进入周期”外观较紧但可达。另[数据库边界](../2026-09-30-recurrence-boundaries/README.md)7组证明三代双周日期、8请求并发仅一后继、插入失败回滚/重试与KR历史不变。父子工作区静态差异已补审；持续压力/多实例、浏览器多代操作和实际午夜/其他日期矩阵仍需核对。 |
| 仪表盘（2） | overview page、OverviewWorkspace | [四类队列和直达](../2026-09-29-stage-4-e1/README.md) | 装配与父级结束过滤已局部审查；不把当时未保存的截图当成当前截图文件。 |
| 知识库（2） | knowledge page、KnowledgeWorkspace | [笔记切换](../2026-09-30-save-concurrency/README.md)、[选库及扫描刷新](../2026-09-30-knowledge-vault-selection/README.md)、[发布闭环](../2026-09-30-knowledge-publication/README.md) | 选库/扫描各四项 GREEN；图片草稿、独立快照、匿名正文/图片、源修改与审查、手机下架/重发、扫描与草稿交错、附件改选/发布互斥及布局共12组已补验。[提示时序](../2026-09-30-feedback-order/README.md)再补5组：发布失败与旧扫描两种顺序、发布/下架/审核成功后释放旧扫描；共享反馈修复先失败后通过。不同草稿/附件及其余错误组合仍开放；真实审核只核对旧记录DB决定与新提示，不证明相同change id合并分支。 |
| 转换目标路由（1） | activities page | [目标切换与异常](../2026-09-23-stage-3b/README.md) | 已有同页面目标变化、目标缺失与异常转换证据。 |
| 后台外壳（2） | workspace layout、AdminShell | [手机导航](../2026-09-29-f2-mobile-partial/README.md)、[六页头像](../2026-09-30-readiness-ui/README.md) | 主代理核对 AdminShell 差异中的来源 key、错误回退及初始失败检查；12 个可见头像实际加载。本轮没有重验失败回退或完整键盘路径。 |
| 初始化（1） | SetupForm | [原生 POST](../2026-09-23-stage-3c/README.md) | 主代理核对当前分支仅增加 `method="post"`，不把此项扩大为完整初始化流程重验。 |
| 共享后台样式（1） | admin.module.css | 上述首页、队列、弹窗及六页截图 | 主代理核对新增队列、首页三栏/手机页签、readiness 与周报提示；workspaceTabs 仅由首页使用。当前呈现证据不覆盖每条 CSS 在所有宽度、空状态和主题下的效果。 |

## 2026-10-02 OKR 静态审查补充

[五个父子工作区完整分支差异](../2026-10-02-okr-branch-review/README.md)已由主代理逐项核查，相关公开条件、权限入口、重复行动事务/迁移和定位链一并追踪，未确认新增阻断缺陷，定向7文件/141项通过。上表OKR行中的“父子工作区完整差异审查”静态部分不再列为未完成；其余浏览器、日期/压力边界仍按实际证据处理。本次未补浏览器交互，也不扩大为全分支审查完成。

## 2026-10-02 图片来源边界补充

[共享图片路径校验](../2026-10-02-home-image-paths/README.md)现核对URL解析后的路由格式和原类别，修复路径逃逸及静态→媒体资源查询绕过；最终581项全量、类型/代码检查及独立构建通过，独立复审无待修问题。默认六个静态文件引用实际存在。任意静态/历史/生产资源是否存在仍按原发布预检处理，不将此修复称为完整资源或浏览器验收。

## 下一批可继续的本地核查

2026-10-02后续 [图片alt字段定位](../2026-10-02-home-alt-target/README.md)已补13组真实Edge（桌面/375、dirty四入口、跨页面取消），正确任务/展开/焦点/滚动/保存均有证据，Minor复审关闭。全量590项及类型/代码/构建通过。真实AI配置只读核对为缺少周报默认设置，仍需环境信息；真实IME与其他未覆盖矩阵不扩大为完成。

2026-10-02已完成 [完整75文件分支静态审查与修复复审](../2026-10-02-whole-branch-review/README.md)。iframe原位输入的刷新/关闭保护Important已关闭；该批当时延后的二维码alt字段快捷定位Minor已由上述后续修复关闭。下列条目为尚未完整覆盖的实际交互范围，不再作为静态差异未读的证明。

1. 知识库剩余不同草稿、附件及其他失败组合；图片发布闭环、扫描与创建草稿交错、附件保存互斥已验。[并发提示与旧扫描](../2026-09-30-feedback-order/README.md)另5组覆盖较新发布失败的提示寿命，以及发布/下架/审核成功后释放旧扫描的数据与提示；真实审核未覆盖同change id的合成合并分支，仍不能称完整并发矩阵。
2. 公开编辑器及其余组件/全局 CSS 的组合交互，公开路由实际点击与目标页呈现；重复行动持续压力/多实例、浏览器多代操作及实际午夜/其他日期边界。导航中英文中间宽度、键盘/触屏、跨断点、语言和QR已补24组；重复行动三代双周、8请求并发与数据库插入失败回滚/重试已补7组，不能继续笼统列为未做。
3. 公开条件的其他证据组合、上传及 CRUD/公开页实际渲染；六类满足条件样例和已有双语 PDF 下载已补验，不继续将这两个具体场景列为未做。

发布范围、服务器预检、生产迁移/旧版本回滚兼容性、备份与 Linux 构建仍需按部署门槛处理；本清单不构成合并或部署授权。C1–C5 待范围确认，F2/F4 保持未勾选。
