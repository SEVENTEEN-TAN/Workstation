# Weekly draft save boundaries

Actual isolated integration run: `run-1d34c05b-c369-4020-9a08-5a90dab55897/results.json`.
The matching `server.log` preserves startup output. No application source was modified.

The run used the existing `.next` production build on an initially free `127.0.0.1:3020`,
HEAD `db4684132f50f43105cbac251cff23d87f8d1928`, build ID `pUbFzuInaSfkOeDR4h46D`.
Relevant source and built route SHA-256 values are recorded in the JSON and were checked
again after the requests; all remained unchanged. The database was a UUID-owned Temp copy
of the specifically authorized source database. A new user and a session containing only
the hash of a random token authenticated the requests. The token and request headers are
not in the evidence.

## Results

All **18 assertions passed**, across **14 actual PATCH requests** to new isolated fixtures.

| Check | Actual result |
| --- | --- |
| Three independent bursts, each two distinct four-field copies with the same old version | Every burst returned `[409, 200]` |
| Concurrent dispatch evidence | Separate sockets; both request intervals overlapped and both bodies were sent before the first response in every burst |
| Stored winner | All four fields and the stored version matched the sole 200 response in each burst |
| Losing copy retried with the stale version | 409 in each burst; full stored record unchanged |
| Losing copy retried with the current stored version | 200 in each burst; all four fields persisted together and version advanced |
| Real SQLite `BEFORE UPDATE` trigger using `RAISE(ABORT, ...)` | 400; entire record, including all fields and `updatedAt`, unchanged |
| Trigger dropped in `finally`, retry with the original version | 200; complete four-field copy persisted and version advanced |
| Cleanup | Database disconnected; owned Next PID exited; realpath, exact UUID basename, and owner verified before deleting the Temp directory; port 3020 free |

The deliberately injected database failure returned the actual Prisma message
`Invalid prisma.weeklyActivityDraft.update() invocation: Foreign key constraint violated on the foreign key`
(exact whitespace/backticks are retained in JSON). No unexpected Prisma response, 500,
or pair of 200 responses occurred in the concurrent requests.

## Verification and limits

The specified Node runtime completed `--check` and the repository's ESLint check of
`weekly-save-api.cjs`, both with exit 0. The integration runner also exited 0.

These three bounded bursts demonstrate overlapping HTTP requests, rather than proving
every possible database transaction interleaving. The optional eight-request burst was
not needed. The runner uses the existing production build; it does not rebuild `.next`.
Next printed its existing `output: standalone`/`next start` advisory, then served the
requests successfully. The database failure's raw Prisma text and 400 classification
remain visible as current API behavior for the root agent to evaluate; no fix was applied.
Browser navigation/storage recovery belongs to the separate evidence task.

## Reproduce

From this worktree in PowerShell (port 3020 must be free):

```powershell
& 'C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' 'docs/evidence/2026-09-30-weekly-save-boundaries/weekly-save-api.cjs'
```

The script creates a new UUID evidence run, enforces the specified HEAD, launches only
its own server, preserves failed assertions as failures, and deletes only its verified
owned Temp directory. Existing processes are never terminated.

## 2026-10-02 主代理独立重跑

使用最新生产构建 `lypQpSO9-mFGtL-dUCy5o` 重跑：[run-0c7989e1-12e2-4b80-9951-7a833d451bbf/results.json](run-0c7989e1-12e2-4b80-9951-7a833d451bbf/results.json)。**18/18 通过，14 次真实 PATCH**；三次双请求突发分别为 `[409,200]`、`[200,409]`、`[200,409]`，均确认两条独立 socket 的请求重叠且 body 在首个响应前发送。四字段与版本匹配唯一胜者，旧版本重试 409 不改记录，当前版本重试 200；实际 SQLite 触发器失败仍为 400、整条记录及版本不变，删触发器后原版本重试 200。

主代理核对原始 JSON、5 个相关源码摘要与当前文件、构建编号及清理结果；全部一致。所属数据库断开、服务退出、UUID/realpath/owner 验证后删除 Temp，3020 空闲。本轮没有改周报保存业务代码，不把有限突发升级为所有数据库调度或持续压力的证明。原始运行和两次独立重跑均保留。

后续提交改变 HEAD 后复现时，先设置 `$env:EXPECTED_HEAD = (git rev-parse HEAD).Trim()`；`SOURCE_DB` 可指向另一份独立已迁移测试库。脚本仍校验 HEAD、源码与构建路由在运行期间不变。

旧历史修复后的最终构建 `zMAzau2vY3sDBrnISDYl7` 再次独立运行 [run-6e93b13c-429e-4173-91db-9f20e0d07f0c/results.json](run-6e93b13c-429e-4173-91db-9f20e0d07f0c/results.json)，18/18 通过，14次PATCH。三组双请求均 `[200,409]`，发送/响应重叠、四字段一致、旧/新版本重试及SQLite触发器回滚/重试断言全部通过；源码、构建路由和HEAD前后不变，清理成功。这份记录是最终构建的API证据。

未知锚点位置推断修复后的最新构建 `5XM__utDMz2yLZPp0q9PJ` 再次独立运行 [run-1f7843d7-08b1-4d8a-afaf-cd642405e28d/results.json](run-1f7843d7-08b1-4d8a-afaf-cd642405e28d/results.json)，**18/18通过，14次PATCH**。三组双请求均 `[200,409]`；重叠发送、唯一胜者四字段和版本、旧/新版本重试、触发器失败400完整回滚与恢复后重试全部通过。5个相关源码摘要、构建编号和运行期间稳定性核对见导航验证摘要；服务退出、库断开、所属Temp删除，3020空闲。此记录取代上段作为本批最终API证据；保存业务代码保持不变。

后续恢复副本清理修复使用构建 `QDZ3X7Bqy2gvbXSqNr_dN` 再次独立运行 [run-8615cff5-8c6b-4a2f-b20d-f370bba08b86/results.json](run-8615cff5-8c6b-4a2f-b20d-f370bba08b86/results.json)，18/18通过、14次PATCH，三组均200/409；源码5个摘要、实际路由摘要和构建编号经主代理核对，所属服务/库/Temp已清理，3020空闲。保存业务代码未改；此记录为后续清理修复的API证据，不能与前一批19组构建混用。

v31复核补上手动回退输入后的清理保护；中间构建 `uwA60YZrQV54ePvBEEsv0` 的 [18项运行](run-73970fca-5814-4dba-8f47-f5ca4ba24af5/results.json) 保留。最终构建 `YDX50WB22r7Pd9kD-nWRY` 使用 [run-41dc0dee-9dca-436c-97bd-cad0418fcd58/results.json](run-41dc0dee-9dca-436c-97bd-cad0418fcd58/results.json)，18/18通过、14次PATCH，三组均唯一200/409；源码、实际API路由摘要和构建编号经主代理核对，清理完成。此为最终27组导航对应的API证据，保存业务仍未修改。
