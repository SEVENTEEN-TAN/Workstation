# 公开条件提示与后台头像可视验收

范围：`/admin/projects`、`/admin/experience`、`/admin/skills`、`/admin/resume`、`/admin/activities`、`/admin/okr`，Edge 无头浏览器，桌面 1440×1000、手机 375×900，设备缩放 1。

`readiness-ui.mjs` 复制任务指定 sourceDB 到独立临时目录。源库 6 类记录数量均为 0，仅在复制库中创建项目、经历、能力域、动态、OKR 周期各 1 条 PRIVATE 中文记录；简历保留中英文未上传状态。继承已发布主页的头像。使用复制库测试会话，不保存会话令牌或数据库。只读取后台页面和滚动操作入口，没有执行增删改业务操作。

主代理独立重跑结果见 [dom-results.json](dom-results.json)：12 个页面 HTTP 200；14 组 PublicReadiness 含阻断说明、展示去向和生效步骤；12 页 document/body scrollWidth 均不超过视口；提示没有被祖先容器裁切。42 个可见主区域按钮/链接逐一 scrollIntoView 后位于视口、中心无遮挡。12 页可见品牌图片均 complete=true、naturalWidth=1122。无 pageerror。最新日志保留 165 条 /admin/... 请求的 net::ERR_ABORTED（采集包含页面关闭阶段），无其他 requestfailed 类型；本次不宣称全部网络请求成功。

子代理将全部截图先保存，再逐张打开视觉检查；其完整重跑生成的 12 张也已重新查看。主代理随后独立重跑完整脚本，核对结构化结果和代表截图。提示文字正常换行、没有横向溢出或裁切，主要操作可见或可滚动到。

| 步骤 / 页面 | 桌面证据 | 手机证据 | 本次观察与结果 |
| --- | --- | --- | --- |
| 1 / projects | [桌面](01-projects-desktop.png) | [手机](01-projects-mobile.png) | 可辨识“视觉验收项目”；私密与缺英文各项完整展示，首页卡片同步、草稿、发布步骤可读；新建、AI 整理、编辑、删除可达。通过。 |
| 2 / experience | [桌面](02-experience-desktop.png) | [手机](02-experience-mobile.png) | 可辨识“视觉验收机构 · 测试工程师”；私密、英文机构/职位/描述阻断项与前台路径可读；新建、编辑、删除可达。通过。 |
| 3 / skills | [桌面](03-skills-desktop.png) | [手机](03-skills-mobile.png) | 可辨识“视觉验收能力”；未添加技能、没有合格公开技能说明可读；新建、公开页、编辑、删除可达。通过。 |
| 4 / resume | [桌面](04-resume-desktop.png) | [手机](04-resume-mobile.png) | 两个语言槽均明确尚未上传文件；在线简历与公开 PDF 下载条件可读；预览与两处上传入口可达，手机英文槽通过滚动到达。通过。 |
| 5 / activities | [桌面](05-activities-desktop.png) | [手机](05-activities-mobile.png) | 可辨识“视觉验收动态”；私密、英文标题/摘要阻断项与动态页/首页去向可读；新建、编辑、删除可达。通过。 |
| 6 / okr | [桌面](06-okr-desktop.png) | [手机](06-okr-mobile.png) | 可辨识“视觉验收周期”；私密、英文周期名称阻断项、/okr 去向与生效步骤完整；新建、进入周期、编辑、删除可达。通过。桌面“进入周期”绿色底紧贴文本，手机为宽条外观，记录为观察，未修改样式。 |

复跑：在仓库根目录使用 Node 执行 `docs/evidence/2026-09-30-readiness-ui/readiness-ui.mjs`。脚本默认端口 3012；可用 `SOURCE_DB`、`RUNTIME_PACKAGES`、`EDGE_EXE`、`PORT` 覆盖本机路径。要求本分支 `.next` 已构建，Prisma 客户端与运行时 Playwright 可用。重跑会覆盖本目录截图和 DOM 结果，视觉核对须重新完成。

确定性验证：主代理独立重跑脚本退出 0；全量 ESLint 退出 0。清理结果全部 true：关闭自有 Edge、断开 Prisma、停止自有服务、检测 3012 空闲、核对解析后的临时目录位于系统 Temp 且匹配本任务前缀后，删除自建目录及复制数据库/日志。

覆盖限制：本次实际覆盖 PRIVATE/缺英文阻断提示与简历未上传，未覆盖满足条件、完整技能证据、已上传简历、头像失败回退、CRUD 或完整可访问性；不代表整项 F4 完成。未修改业务代码、`.serena` 或其他代理证据，无提交、部署或生产操作。
