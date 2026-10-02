# 首页图片路径解析边界

日期：2026-10-02。基线 `3e9b70dc5f900b728a26ee96c8ed63b2e6db46be`，分支 `feat/homepage-visual-editor`。本批业务源码只改 `src/lib/content/schema.ts`，回归只加在 `tests/site-content-schema.test.ts`。

## 复现及修复

既有设计只允许人物图与二维码引用 `/images/...` 或 `/api/assets/{id}`。原正则只检查原始字符串，因而 `/images/../admin/login`、`/images/%2e%2e/admin/login` 可通过保存与编辑校验，URL 解析后实际 pathname 却为 `/admin/login`；`/api/assets/%2e%2e` 同样解析成 `/api/`。

共享校验现先检查原格式，再通过标准 URL 解析器核对 pathname 的格式和原命名空间。这样同时保护编辑态消息与保存/发布/恢复/读取态内容，不改变保存值，不增加依赖、文件读取或网络请求。

初版只检查解析结果仍属于两类路径之一。独立审查指出 `/images/../api/assets/unvalidated-image` 会被接受，而媒体存在性查询按原始 `/api/assets/` 前缀提取 ID，导致跳过该查询。执行者没有将这一同根因路径留作存量问题；实际加入失败用例后，要求解析结果保留原路径类别，关闭这一绕过。

## 验证

| 证据 | 实际结果 |
| --- | --- |
| [原始 RED](schema-red.log) | 8 种 escape 路径全部错误接受；8 失败、12 通过 |
| [跨类别 RED](schema-namespace-red.log) | 初版修复仍接受静态 → 媒体路径；1 失败、20 通过 |
| [最终定向 GREEN](schema-namespace-green.log) | 五文件 / 89 项通过；9 种无效路径在保存态、编辑态均拒绝；5 种合法路径保留原值 |
| [最终全量](verification-vitest-final.log) | 85 文件 / 581 项通过；比本批前新增 14 项 |
| 类型与代码检查 | `verification-typescript.log`、`verification-eslint-final.log` 对应命令均退出 0 |
| 独立 SQLite 构建 | 空白任务临时库应用 32 项迁移、schema validate 和 seed 后生产构建退出 0，生成 56 页；Build ID `C-3wi8e8hycxpO4V2KWBo` |
| [默认静态资源](bootstrap-static-images.json) | bootstrap 快照六个去重静态图片引用均为当前 `public` 目录实际文件；不覆盖任意历史或生产快照 |
| [最终复审](review.md) | 跨命名空间绕过关闭，无待修 Critical / Important / Minor；仅本批可以提交推送 |

原始路径的中文文件名、编码空格、嵌套静态文件、正常媒体 ID 均保留。允许同一静态命名空间内的 `sub/../portrait.png`，不要求禁止所有 dot segment。初版 GREEN 与 580 项中间测试日志保留为诊断，不代替上述最终结果。

构建首次迁移在尚不存在的 SQLite 文件上返回 Schema engine error；实际创建该空文件后，同一迁移命令成功应用全部 32 项迁移，错误日志仍保留。命令结果、源码与日志摘要见 [verification-summary.json](verification-summary.json)。本批没有 schema.prisma 或迁移变更，没有连接生产数据库。

## 资源清理与边界

构建所用任务临时库为 `C:/Users/23399/AppData/Local/Temp/workstation-home-image-74cc5c8774f0499cbb1f13fc7f4e6c3f.db`。删除前已核对创建记录、绝对路径及普通文件类型；自动审批拒绝删除命令，仅给出 `blocked by policy`，没有具体原因。该文件仍保留，`verification-build-summary.json` 的 `cleanupCompleted` 保持 false，不宣称清理完成。本轮没有启动浏览器或测试服务。

静态路径保存时仍不验证任意文件存在性；当前 UI 只通过媒体库替换人物图/二维码，默认静态资源已有上述清点。发布前仍须核对实际候选快照/历史快照兼容性及生产资源，不能用默认文件清点替代。编码路径是否对应可用资源也留给资源验证。

真实中文输入法、完整功能分支审查、发布范围、服务器/迁移预检、备份和回滚门槛仍开放。计划保持 23/30，C1–C5 待确认，F2/F4 不勾选；本批没有合并、部署或线上验收。

差异检查仅排除原始工具 `.log` 输出的结尾空行，保留输出原文；源码、测试、Markdown、JSON 执行标准差异检查。
