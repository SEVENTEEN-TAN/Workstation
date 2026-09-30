# 六类后台公开条件：满足条件状态验收

代理首次实测时间：2026-09-30 12:50（Asia/Shanghai），随后主代理独立重跑通过，当前结构化记录及截图为该重跑结果。工作树 `homepage-visual-editor`，HEAD `3d1d7c9f54c94cdbe0fa965c0544ce71406ec4bd`；使用任务指定的既有 `.next` 生产构建，Build ID `dSWTfnTKi3ugfbSgQSNbZ`，未重新构建。主代理逐项比对 11 个源码摘要和当前 Build ID，均一致；本次没有重新证明构建可由该 HEAD 重现。

范围：Edge 无头浏览器，设备缩放 1；桌面 1440×1000、手机 375×900，各访问 `/admin/projects`、`/admin/experience`、`/admin/skills`、`/admin/resume`、`/admin/activities`、`/admin/okr`。

## 独立样例与结果

[readiness-positive.mjs](readiness-positive.mjs) 先确认 3013 空闲，再复制指定的已迁移 SQLite 到带随机 owner 标记的专属 Temp 目录。六类源表均为零记录；只向复制库添加满足公开条件的样例：完整双语项目与链接、完整双语工作经历、公开能力域/技能（关联公开项目及有英文标题的文章证据）、双语职业动态、PUBLIC/ACTIVE 双语 OKR 周期，以及 ZH/EN 两份实际存在的公开 PDF。PDF 写在自有 Temp/resumes，子服务通过 `RESUME_UPLOAD_DIR` 指向该目录。会话令牌仅内存使用，结果不保存令牌、数据库或 PDF 摘要。

[dom-api-db-results.json](dom-api-db-results.json) 保留真实数据库样例字段、六类后台 GET API 响应、两份公开 PDF 下载结果和每页 DOM 几何检查：

- 12 页 HTTP 200，14 组提示均显示“满足前台展示条件”、展示去向与生效步骤，无阻断说明；两种视口下提示完整，没有被祖先容器裁切。
- 12 页 document/body scrollWidth 不超过视口，无横向溢出；60 个主区域按钮/链接/文件选择标签逐一滚动到视口，中心命中自身或其子节点，无遮挡。
- 六类后台 GET API 均 HTTP 200；`/api/resume/zh` 与 `/api/resume/en` 均 HTTP 200、application/pdf，返回字节与实际临时 PDF 完全相同。
- 12 页均无 pageerror。主代理重跑记录 176 条 `net::ERR_ABORTED`（代理首次为 161 条），采集包含关闭页面阶段，没有其他 requestfailed 类型；不宣称所有请求成功，也没有将每次中止归因于关闭页面。

准备脚本时两次失败及对应工具输出摘录保存于 [setup-attempts.json](setup-attempts.json)：第一次自有项目 fixture 的链接缺少必填 `kind`，导致项目反序列化 GET 500；补上 WEBSITE 后第二次误向只接受 POST 的 `/api/admin/okr/cycles` 发 GET，返回 405；改用 `/api/admin/okr` 后完整通过。这两项为本次 fixture/脚本错误，不作为业务缺陷报告。每次失败均停止自有服务、断开 Prisma、核对 owner 并删除自有临时资源，端口检查均空闲。

## 逐张视觉检查

代理首次运行的 12 张截图已逐张打开检查，结果如下。主代理重跑后抽查最新能力手机、简历手机及 OKR 桌面截图，提示和入口与记录一致。手机全页截图高于视口时，脚本另外逐一实际滚动验证操作入口可达；不把主代理抽查扩大为逐张视觉重验。

| 页面 | 桌面 | 手机 | 观察 |
| --- | --- | --- | --- |
| projects | [截图](01-projects-desktop.png) | [截图](01-projects-mobile.png) | 双语公开项目可辨识；就绪、项目页/首页卡片去向、同步/草稿/发布步骤完整；手机按钮自然换行。 |
| experience | [截图](02-experience-desktop.png) | [截图](02-experience-mobile.png) | 机构/职位、PUBLIC 标记及就绪提示可辨识；经历页/首页职业路径与生效步骤完整。 |
| skills | [截图](03-skills-desktop.png) | [截图](03-skills-mobile.png) | 公开能力域、1 技能及就绪提示完整；能力页/首页能力区块去向、部分技能证据可省略说明可读。DB/API 另证实项目和文章两种证据。 |
| resume | [截图](04-resume-desktop.png) | [截图](04-resume-mobile.png) | 两个文件名、公开标记、就绪/可用文件下载提示和替换/设为私密/下载验证/删除入口完整；手机上下布局，无截断。 |
| activities | [截图](05-activities-desktop.png) | [截图](05-activities-mobile.png) | 双语职业动态与就绪提示完整；动态页/首页及无需发布首页说明可读。 |
| okr | [截图](06-okr-desktop.png) | [截图](06-okr-mobile.png) | 满足展示条件周期计数为 1；周期就绪提示、/okr 去向与生效步骤完整。桌面“进入周期”绿色背景仍紧贴文字，手机为宽条；可达且未裁切，保留既有观察，未改样式。 |

## 重跑与清理

从仓库根目录执行 `node docs/evidence/2026-09-30-readiness-positive/readiness-positive.mjs`。默认依赖本机 Node、Prisma 客户端、已构建 `.next`、bundled Playwright、Edge 及任务指定源库；可通过 `SOURCE_DB`、`RUNTIME_PACKAGES`、`EDGE_EXE` 覆盖本机路径。固定端口 3013；端口占用即退出，不终止已有服务。复制源库六类表必须为空，否则在写 fixture 前退出。重跑覆盖本目录结果与截图，须重新做视觉检查。

代理及主代理重跑均退出 0；主代理另运行两处新增脚本的定向 ESLint，退出 0。清理全部 true：自有 Edge 关闭、Prisma 断开、自有 Next 服务停止、3013 空闲；递归删除前核对 realpath 为系统 Temp 直属目录、目录名匹配任务前缀、owner 标记与本次一致；随后删除临时数据库、PDF、日志及 owner 文件。本次没有修改业务源码、共享构建、`.serena`、原库或生产资源。

覆盖限制：此验收只证明六个后台列表的满足条件提示及已有公开 PDF 文件可用。没有点击 CRUD/AI/公开切换入口，没有验证上传流程、PDF 阅读器视觉排版、长文件名、失败/缺失文件、头像失败回退、完整可访问性，或公开页面实际渲染、首页选取同步/发布、OKR 目标/KR/行动/复盘。两类技能证据存在于 DB/API；文章链接为本地样例，不证明真实外部文章可用。此证据不代表 F4 整体完成。
