# 保存与生成时序验收（2026-09-30）

## 环境和边界

- 从 `3156ce5700e0926c93f33bfa61ba9bc781d8a087` 开始核查，其本地与远端功能分支 SHA 已核对一致。
- 使用独立临时 SQLite 副本、测试会话、本机生产构建及真实 Edge 浏览器（Playwright headless）。所有发布、恢复、草稿写入均发生在该临时数据库。
- 通过拦截响应暂停真实 API 的返回，检查请求等待期间的页面状态，再放行响应并核对保存值；失败场景由浏览器路由返回明确的模拟 500。
- 中文文字通过自动化直接输入；没有使用 Windows 系统中文输入法，不满足 F2 的 IME 手工验收。
- [机器检查结果](results.json) 共 14 项通过，未记录到页面脚本错误。截图用于辅助核对；控件禁用及数据库值由实际 DOM 和 API 返回验证。

## 已验收

| 场景 | 操作与结果 | 证据 |
| --- | --- | --- |
| 首页保存 | 暂停草稿回读，继续编辑预览文字；返回后保留新文字和未保存状态，服务器保存的是提交时内容 | [保存后工作副本](home-save-retains-new-edit.png) |
| 首页发布 | 先保存，再暂停发布后的草稿回读并继续编辑；返回后新文字仍为未保存内容 | [发布后工作副本](home-publish-retains-new-edit.png) |
| 首页刷新 | 确认刷新后暂停回读，继续编辑；返回后保留等待期间的新文字和未保存状态 | results.json |
| 首页恢复 | 正常历史恢复成功且只生成草稿；等待时确认弹窗仍在 | results.json；本项不证明恢复期间继续编辑的并发情形 |
| 周报保存 | 四个输入、取消、编辑、AI 候选、转换与生成入口在保存期间禁用，成功后 API 返回提交值 | [保存等待](周报-save-lock.png) |
| 里程碑保存 | 四个输入、取消、草稿编辑和转换入口在保存期间禁用，成功后 API 返回提交值 | [保存等待](里程碑-save-lock.png) |
| 时间线保存 | 同上，时间线同步入口也禁用，成功后 API 返回提交值 | [保存等待](时间线-save-lock.png) |
| 三类草稿失败重试 | 模拟保存失败后编辑器和输入保留并重新启用；取消拦截后重试，真实 API 保存正确 | [周报](周报-save-error-retains-input.png) / [里程碑](里程碑-save-error-retains-input.png) / [时间线](时间线-save-error-retains-input.png) |
| 周报生成保护 | 桌面与 375×812 手机宽度，存储不可用且生成返回延迟时锁定旧稿输入及相关操作；返回后输入重新启用 | [桌面](weekly-generate-locked-desktop-after-fix.png) / [手机](weekly-generate-locked-mobile-after-fix.png) |
| 知识库笔记选择 | 深链接自动打开 A，或手动打开 A，再选择 B；A 的真实读取响应延迟返回后，标题和正文仍为 B | [深链接](knowledge-current-note-after-fix.png) / [手动切换](knowledge-manual-selection-after-fix.png) |

## 本轮发现和修复

1. 周报生成另一周草稿时，旧稿输入仍可修改。如果浏览器存储不可用，成功返回会切到另一周草稿，等待期间的新输入无法恢复。已在浏览器复现并重新打开旧稿确认丢失：[等待期间](weekly-generate-before-response.png)、[重新打开旧稿](weekly-generate-lost-input-before-fix.png)。复用现有保存／转换锁定方式，加入生成进行中的保护；同一检查先失败后通过。
2. 仪表盘 JSON 序列化测试把 `2026-09-30T00:00:00Z` 固定为未来截止时间，日期到达后产生与本轮代码无关的失败。测试改用运行时一天后的截止时间，继续断言日期序列化和未到期状态；业务代码未改。
3. 知识库深链接打开笔记后，初始读取与手动切换使用两条独立加载路径。切到 B 后，A 的晚到响应仍会覆盖 B 正文；[修复前截图](knowledge-stale-note-before-fix.png) 及浏览器断言已复现。统一为随当前笔记选择执行的 effect，在选择变更、关闭或卸载时忽略旧响应；同一深链接用例先失败后通过，并补验手动 A→B 的选择顺序。首次浏览器检查因测试库未设置已扫描文件数量而无法找到 B 的入口；补齐测试索引状态后得到有效复现，此次超时不算验收通过。

可重跑的浏览器检查：[weekly-generation-lock.mjs](weekly-generation-lock.mjs)。在已认证、使用独立测试库且至少有一条可编辑周报的 Playwright `page` 上调用 `verifyWeeklyGenerationLock(page)`；其会生成或打开 2040-01-16 至 2040-01-22 的测试周报、模拟存储不可用，完成后重载页面。不要对生产环境运行。

[knowledge-note-selection.mjs](knowledge-note-selection.mjs) 导出 `verifyKnowledgeNoteSelection(page, options)`。提供独立测试知识库的深链接 URL、`firstPath`、`secondLabel`、两条不同的正文 `firstBody` / `secondBody`；提供 `firstLabel` 可检查手动打开第一条笔记。检查暂停第一条笔记的真实响应，选择第二条后再放行，断言第一条正文没有回写。测试知识库需已索引两条实际存在的 Markdown 文件，深链接还需对应源修订。

## 本地回归

- 全量：83 个测试文件、557 项通过。
- TypeScript、ESLint、差异检查通过。
- 使用独立、已迁移 SQLite 的生产构建通过，生成 56 个页面。
- 没有执行合并、服务器预检或部署；F2、F4 保持未完成。
