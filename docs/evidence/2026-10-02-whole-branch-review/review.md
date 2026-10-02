# 独立整分支审查

审查者：`whole_branch_review_20261002`。原候选`f0723cf..5023732`的75个源码/迁移/配置差异完整阅读，75个原候选源码SHA256全部核对一致；调用方、权限、错误映射、媒体引用及测试契约另行追踪。没有修改文件/index/HEAD，没有启动浏览器、服务、全量测试或构建，没有委派代理。

## 实际覆盖

| 模块 | 文件数 | 范围 |
| --- | --- | --- |
| 首页快照、编辑器、保存服务 | 11 | preview page、HomeWorkspace、HomepageEditor、HomepageVisualWorkspace、content-editor、visual-editor-protocol、HomeVisualEditor、visual-editing、homepage-projects、content/schema、site-content服务 |
| 公开首页及装配 | 10 | About、Footer、Hero、HomeExperience、HomeJourney、Navbar、RecentWorks、Services、i18n、public-resume服务 |
| 周报、三类草稿、反馈和导航保护 | 15 | 周报生成/AI路由、三类草稿工作区及服务、WeeklyHistoryTracker、weekly-editor-state、useAdminAction、workspace-utils、两个草稿/动态校验器、root layout |
| OKR、重复行动和迁移 | 13 | 唯一迁移、Prisma schema、公开条件/日期helper、okr/public-data服务、okr校验器、六个OKR工作区/提示组件 |
| 公开条件和后台说明 | 12 | 共享readiness、五个公开业务服务、五个业务工作区、activities page |
| 知识库 | 4 | knowledge page、KnowledgeWorkspace、knowledge-scan-update、knowledge-publications服务 |
| 仪表盘队列 | 4 | overview page、overview-queue路由、OverviewWorkspace、overview-queue服务 |
| 后台壳、样式和配置 | 6 | workspace layout、AdminShell、SetupForm、后台/全局CSS、vitest配置 |

合计75/75；具体路径与原候选摘要见`source-inventory.json`。

## 原候选问题与最终复审

原候选Critical 0，Important 1，Minor 1。Important为首页未回传输入的原生卸载保护缺失；执行者实际Edge RED中父级干净、原位焦点保持，刷新没有确认且文字恢复旧值。已在真实组件回归RED后修复，见 [输入保护证据](../2026-10-02-home-preview-unload/README.md)。

独立复审读取唯一业务源码`HomeVisualEditor.tsx`及新增5项组件测试、Edge RED/GREEN和runner。原Important已关闭，修复未引入新Critical/Important。审查者核对源码SHA256为`a669eee43d6e3bc69c2c45ff8c6c744411febc45ce13507ad3549bdaf049a314`，与最终Edge记录一致。

复审确认input/paste/compositionstart标记未回传输入、有效commit清理、未结束组合输入的flush保留保护、事件卸载清理完整。真实Edge取消原生刷新/关闭均保留文字，保存及干净聚焦刷新没有多余确认。仅确实出现beforeunload且错误为取消/超时时接受reload等待错误，后续仍检查字段和文字。审查者阅读定向17项、全量586项日志，没有独立重跑。

### 未修复Minor：二维码替代文本入口未选择目标任务

`HomepageVisualWorkspace.tsx:115`的二维码alt链接只切字段视图；`HomepageEditor.tsx:186`默认identity任务，footer.wechatAlt仅在contact任务渲染。真实组件服务端渲染确认默认存在portraitAlt，缺少wechatAlt。用户仍可手动切换“联系与导航”找到字段，当前快捷入口不能定位。

按执行计划技能Minor处理规则记录延后，不扩大本批输入保护修复范围。后续应传入目标字段/任务，并在挂载后定位及展开高级字段，不能只改锚点或CSS。

## 考虑后排除的行为与执行者裁定

- 真实系统IME、真实AI、历史/生产快照资源与长度兼容、Linux构建/备份/迁移/回滚：本轮无实际证据，继续列为交付门槛。
- 重复行动按旧截止日推导、不自动跳过历史日期：符合既有日历基准，接受排除新需求。
- 删除后继或重开父项不再次派生：符合D1保存历史规则。
- 项目技能证据简化publicReady：默认来源已由listPublic筛选，未确认私密泄漏，不列确认缺陷。
- 公开helper替代完整schema后对异常数据库记录的差异：正常API写入仍受完整校验，无异常历史记录实证，不列确认回归，发布前历史数据兼容核查继续开放。
- 发布/恢复时媒体资源：正常删除检查全部版本引用，未确认正常链路导致失效，生产资源检查继续开放。
- C1–C5：待范围确认，不列为本批缺失功能。

执行者逐条接受上述排除理由，并保留所有F2/F4门槛。整分支静态审查加修复差异复审已完成；未修Minor及真实验收、服务器条件仍存在，没有合并或部署授权。
