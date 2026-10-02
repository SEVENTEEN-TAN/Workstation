# Weekly navigation evidence — original RED and 2026-10-02 GREEN

最新完整验收为 [19/19 GREEN](run-faef91b8-832d-4103-9ac2-f025f49aa3c9/results.json)，构建 `5XM__utDMz2yLZPp0q9PJ`，包含旧路由历史和最终审查发现的旧锚点路径。下面保留原始失败与中间验收，最终实现和边界见文末；较早18组实现仍有未知锚点位置推断缺陷。

## Original 2026-09-30 RED

Run: `run-2255fcbe-3bfa-4191-bc2c-9f34078988be`.
HEAD: `db4684132f50f43105cbac251cff23d87f8d1928`.
Build ID: `pUbFzuInaSfkOeDR4h46D`.
Browser: actual headless Microsoft Edge `154.0.4258.37`.

Only the new evidence script and this run's outputs were written. No business source edits, commits, pushes, or `.serena` cleanup were performed.

## Results

| Case | Result | Verified behavior |
| --- | --- | --- |
| Draft switching | PASS | Dismiss keeps A input; accept opens B; reopening A restores input and recovery. |
| Actual reload | PASS | Real activated `beforeunload` appears; dismiss retains input; accept reloads; reopening restores input; both fixture DB records remain unchanged. |
| Sidebar route, 1440px | PASS | Dismiss retains editor; accept leaves; returning via actual Next link restores input; DB unchanged. |
| Sidebar route, 375px | PASS | Mobile menu dismiss/accept and return recovery work; DB unchanged. |
| Actual Back, normal storage | PASS with observation | Overview → weekly uses a real Next link; `page.goBack()` leaves with **no cancelable dialog**; returning restores input from session storage; DB unchanged. |
| Actual Back, storage throws | **RED** | Same real history navigation produces **no cancelable dialog**; returning shows original DB title, loses unsaved input, and has no recovery; DB unchanged. |
| Storage failure, switch/link | PASS | `Storage.prototype.setItem` throws; accepted switch and sidebar leave are blocked; input stays in memory; recovery remains absent; DB unchanged. |
| Two tabs, same version | PASS | Sequential actual saves return 200 then 409 with identical expected version; loser input and recovery remain; true reload/reopen restores loser input with version-change notice; DB keeps winner title. |

All eight cases executed: **7 PASS / 1 genuine business assertion failure**. Node syntax check passed. No script setup failures or page errors occurred. The reload-dismiss API naturally timed out waiting for a navigation canceled by the real browser dialog; the case independently verified the dialog and retained input before the accepted reload.

## Concrete defect

`WeeklyActivityWorkspace.tsx:137` installs `beforeunload`, which protects document unloading. At `:147`, `guardLinks` listens only to document link clicks. Neither intercepts the same-document browser Back navigation exercised here. At `:193`, input remains in React state when `writeRecovery` fails. The Back navigation unmounts that state; returning at `:101` reconstructs the editor from the original server draft because recovery is absent.

The normal-storage Back case also lacked a cancelable dialog, but its session recovery prevented loss. This is recorded separately from the RED storage-failure case. The two-tab check used sequential saves; it makes no assertion about simultaneous writes.

## Evidence

- Exact assertions, input before/after Back, dialog decisions, PATCH payloads/statuses, fixture versions, source hashes, build identity, and cleanup: [results.json](run-2255fcbe-3bfa-4191-bc2c-9f34078988be/results.json).
- Original editor baseline: [01-desktop-editor-baseline.png](run-2255fcbe-3bfa-4191-bc2c-9f34078988be/01-desktop-editor-baseline.png).
- RED returned editor with original title: [06-back-return-throws.png](run-2255fcbe-3bfa-4191-bc2c-9f34078988be/06-back-return-throws.png).
- 375px route recovery: [04-sidebar-recovered-375.png](run-2255fcbe-3bfa-4191-bc2c-9f34078988be/04-sidebar-recovered-375.png).
- Loser recovery after reload: [09-conflict-loser-reopen.png](run-2255fcbe-3bfa-4191-bc2c-9f34078988be/09-conflict-loser-reopen.png).
- All 13 screenshots and [server.log](run-2255fcbe-3bfa-4191-bc2c-9f34078988be/server.log) remain in the run directory. The four screenshots linked above were visually inspected after execution.

`failedRequests` retains raw `net::ERR_ABORTED` events for admin-route requests canceled during navigation/page closure, including Next prefetches. No failed API request is recorded; the intentional save conflict is the fulfilled HTTP 409.

## Isolation and cleanup

Next started only on port 3019 after a free-port check. A UUID-owned Temp copy of the specified build DB held both valid seven-day fixture drafts and a hashed-token authenticated session. The token was never logged. Edge used a persistent profile inside that owned Temp directory.

Cleanup validated Temp realpath, UUID basename, owner purpose and run ID, plus the child service PID/executable before terminating that child. Browser closed, DB disconnected, owned Next process exited, owned Temp directory deleted, and port 3019 was free. Cleanup errors: none. No unowned process was stopped.

The preceding sections describe the original 2026-09-30 run. Its RED is retained as historical evidence; the final repair and result follow.

## 2026-10-02 统一历史追踪初轮（15组；后补旧历史）

初轮完整运行：[run-18eb98e4-3cd2-415b-95ed-3b61dd773680/results.json](run-18eb98e4-3cd2-415b-95ed-3b61dd773680/results.json)，**15/15 通过**。HEAD 为 `db4684132f50f43105cbac251cff23d87f8d1928`，包含当时尚未提交的修复；构建编号 `lypQpSO9-mFGtL-dUCy5o`。主代理当时核对了全部 10 个源码摘要、实际构建编号、原始断言及清理结果，均一致；无 pageerror。后续旧历史修复的最终源码和构建身份以文末18组运行及验证摘要为准。

- 桌面 1440px／手机宽度 375px，正常存储／`setItem` 抛错，Navigation API 可用／在实际 Edge 启动前禁用，共 8 组历史验收。
- 每组取消 Back 后，URL、当前历史 key/index、全部条目 keys 与输入保持原样；再次 Back、Forward 的取消／接受仍有效。
- `history.go(-3)` 模拟跨三条历史选择；取消保持原条目，存储失败时接受仍阻止离开。脚本分别等待浏览器事件和条目恢复，未用固定休眠判定成功。
- 正常存储接受离开后，前进／返回重开恢复四字段副本的标题；存储失败时无副本、输入仍在内存。恢复存储能力后接受离开，返回仍恢复输入。
- 另外 1 组带 `#weekly-evidence` 的地址，存储失败时跨两条历史返回，取消必须恢复同一片段、历史 key 与输入。修复前 [片段 RED](run-1dad76d0-af92-4a3f-9958-67319330637e/results.json) 恢复到相邻的无片段地址；修复后通过。
- 原生 reload 取消／接受与重开恢复、草稿切换、桌面／手机侧栏离开、存储失败阻止切换／链接，以及两标签同版本 200→409、败者刷新重开保留，另 6 组通过。两标签浏览器检查仍是顺序保存；真实重叠 HTTP 保存另见 [API 边界](../2026-09-30-weekly-save-boundaries/README.md)。

该初轮实现使用 `WeeklyHistoryTracker.tsx` 从根布局启动时给当前及后续应用历史条目记录位置，保留 Next 原有 state。周报编辑器单独监听可取消的离开事件；取消或恢复写入失败时，在 Next 的 `popstate` 处理前保留编辑器并退回原历史位置，恢复事件不交给 Next。当时对未知 fragment 加一的推断已在后续审查中确认不可靠，最终实现移除此分支，见文末。其他表单没有新增离开提示，恢复副本的数据范围保持原有四字段和版本。

初版只监听 Navigation API：原生路径 10/10 通过，但 [缺少能力 RED](run-abcbd0fc-3ee4-4e06-93b4-4d5962bae3da/results.json) 的 4 组失败。局部历史追踪已在 [禁用能力的独立运行](run-18836f6c-ac8a-4158-b421-4ae09c517fb6/results.json) 4/4 通过。原生导航取消后的连续脚本跨条目调用曾被 Edge 忽略，事件记录表明没有第二次 navigate、URL/条目也未改变；[诊断记录](run-5f148b9a-bb35-4e6f-920f-8a7d27ded436/results.json) 保留该失败，不把它当成已证实的数据丢失。最终统一历史追踪后，同一跨条目矩阵全部通过。

主代理已视觉检查最终 [375px 存储失败留页](run-18eb98e4-3cd2-415b-95ed-3b61dd773680/06-history-storage-block-375-false.png) 与 [片段取消后保留输入](run-18eb98e4-3cd2-415b-95ed-3b61dd773680/10-fragment-storage-block.png)，原始截图完整保留。

全量 [Vitest](verification-vitest-2026-10-02.log) 85 文件／567 项通过；独立已迁移 SQLite [生产构建](verification-build-2026-10-02.log) 通过，56 页。TypeScript 与全库 ESLint 均退出 0、无诊断输出，见 [验证摘要](verification-summary-2026-10-02.json)。所有运行的所属浏览器、服务和 Temp 已清理，3019 空闲。

### 边界与复现

这些是实际 Edge 154 与桌面浏览器手机宽度的证据；禁用能力用例不证明所有旧浏览器或真实手机系统。初轮只验证追踪条目；旧历史在后续审查中补验、修复，详见下节。快速交错多次导航及其他浏览器仍需完整发布审查。跨文档刷新／离开使用既有原生 beforeunload，不承诺浏览器自定提示文案。已配置真实 AI 候选、真实系统 IME、整分支审查与生产上线门槛仍开放，F2/F4 不勾选。

从此工作树复现，先使用独立已迁移测试库重新构建，再执行：

```powershell
$env:EXPECTED_HEAD = (git rev-parse HEAD).Trim()
& 'C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' 'docs/evidence/2026-09-30-weekly-navigation/weekly-edge.cjs'
```

`SOURCE_DB` 可指定另一份独立测试库。每次创建 UUID 证据目录；`HISTORY_ONLY=native`、`1`、`fragment` 或 `legacy` 仅用于局部诊断，最终结论使用不设该变量的完整 19 组运行。

## 旧路由历史修复及18组中间验收

独立只读复核指出旧版本留下的 Next 条目没有追踪字段，直接放行会丢失内存输入。创建保留 `__NA` 和 Next tree、去除追踪字段的旧 overview 条目，进入 weekly 后执行真实 reload，再禁用存储写入：两条能力路径均 [RED，无提示返回旧路由](run-5beba2ed-b75a-4508-9768-8df5953fcd9c/results.json)。这是补验后确认的缺陷，已处理。

最终实现为追踪位置附加 scope，避免旧条目之间重复位置。能取得原生历史 index 时，未标记条目也能计算正确距离并恢复原条目。缺少原生能力且距离未知时，拒绝让 Next 卸载当前编辑器，并显示“修改已保留；保存或取消编辑后，会继续返回”。此降级保留输入与原有历史数据，地址栏可能已移动到目标路由；用户保存或明确取消后才完成路由切换。新输入、保存冲突或失败不会清空待处理编辑器。

最终完整 [run-999d89f6-46f5-4f53-86fa-16480818ecce](run-999d89f6-46f5-4f53-86fa-16480818ecce/results.json) **18/18 通过**，构建 `zMAzau2vY3sDBrnISDYl7`：保留前述15组，追加旧条目真实reload后的原条目恢复、无能力时保留输入并明确取消后继续，以及另一独立草稿实际保存200后继续返回、前进/reload重开读取保存值。主代理核对最终10个源码摘要与当前文件、实际构建编号、全部断言及清理，均一致。第一次新增旧条目用例过早读取dialog数量，诊断失败记录 [run-f3feb35c](run-f3feb35c-72cd-4665-b209-d00da6e608ea/results.json) 保留；脚本等待真实dialog事件后，局部 [3/3](run-d9b8f958-b435-4d3f-99ca-2cd5153e0d43/results.json) 和完整18组通过。

最终截图：[旧历史保留输入提示](run-999d89f6-46f5-4f53-86fa-16480818ecce/11-legacy-pending-input-retained.png)、[先保存后返回再重开](run-999d89f6-46f5-4f53-86fa-16480818ecce/12-legacy-saved-return.png)。日志和验证摘要按最终源码更新。快速交错恢复、所有旧历史/片段组合、其他浏览器和真实手机仍是未覆盖范围，未把18组当作全部平台验收。

## 最终未知锚点修复及19组验收

独立只读审查 v29 指出：无 Navigation API 时，仅凭 hash 不同就给未知条目加一，无法区分新建锚点和向后进入旧锚点。旧 `[weekly#old, weekly#current]` 历史在最后条目真实 reload 后，Back 进入未标记的旧锚点被赋予错误位置；随后取消 Forward 可能调用越过末尾的 `history.go(1)` 并卡住恢复状态。

先补真实 Edge 回归：保留 Next state、去掉追踪字段，创建旧锚点历史，真实 reload 后禁用存储、编辑并 Back。[RED](run-5ed73e67-4097-4797-bc9b-43be3526a654/results.json) 确认没有离开确认，是实际业务断言失败。随后移除未知锚点位置推断及其专用缓存；所有未知距离统一使用现有 pending 路径。无原生位置能力时，新旧未知锚点都可能移动地址栏，但编辑器和输入保留，保存或明确取消后才继续导航。已追踪或可读取原生位置的条目仍能恢复准确位置。

局部 [2/2 GREEN](run-7ff96e17-2c81-4258-9609-a38ece02d635/results.json) 验证旧锚点 Back/Forward 保留输入、明确取消后侧栏与 Back 继续可用；新增未知锚点跨两条历史保留输入及全部历史 keys，明确取消后继续目标路由。后一用例按未知距离的真实能力更新，最终实现不再承诺准确恢复该锚点。

最终完整 [19/19 GREEN](run-faef91b8-832d-4103-9ac2-f025f49aa3c9/results.json)，构建 `5XM__utDMz2yLZPp0q9PJ`。前述18组中的未知新锚点用例采用保留编辑器的语义，追加旧锚点往返回归；其余用例全部通过。无 pageerror，所属 Edge/服务/Temp 清理完成，3019 空闲。最新构建 [18项 API 边界](../2026-09-30-weekly-save-boundaries/run-1f7843d7-08b1-4d8a-afaf-cd642405e28d/results.json)再次通过。源码摘要核对、独立构建、567项测试、TypeScript、ESLint及审查结果见 [验证摘要](verification-summary-2026-10-02.json)。

截图：[未知锚点跨条目保留输入](run-a1595b89-e78a-46c6-9ee7-6f3d82696c22/10-fragment-storage-block.png)、[旧锚点取消后继续使用编辑器](run-faef91b8-832d-4103-9ac2-f025f49aa3c9/13-legacy-fragment-resumed.png)。完整19组运行中，同名截图被结束后的截图覆盖；脚本仅调整结束截图名称后独立重跑 [锚点2/2](run-a1595b89-e78a-46c6-9ee7-6f3d82696c22/results.json)，保留前后两张截图，源码与构建不变。这是本批周报修复的验收，整分支发布审查、其他浏览器和真实手机、快速交错导航、所有旧历史/片段组合及真实AI/IME仍开放；总计划23/30，F2/F4保持未勾选。

最终独立只读 [v30审查](final-review-2026-10-02.md) 未发现需修复问题，本批可以提交推送。pending 中失败保存/409保持dirty的结论来自源码，尚未单独实际覆盖该组合，继续保留在F2/F4；不把本批审查升级为整分支发布完成。
