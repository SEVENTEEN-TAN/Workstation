# Homepage refresh/save response order reproduction

Original reproduction: **RED**, reproducible in real Microsoft Edge `154.0.4258.37` (headless). Worktree HEAD: `751cd4e07053f23c5913e35287fc2e474720511a`. The repair and **7 / 7 passing browser checks** are recorded in [GREEN-README.md](GREEN-README.md). The directory label was retained; actual runs occurred on 2026-09-30.

During the original reproduction, only this evidence directory was created; no application source was modified or committed. `.serena/` was preserved. Tests used `127.0.0.1:3012` and independent copies of the supplied clean SQLite database. Session tokens were generated in memory and never logged or saved in evidence.

## Observed sequence

| Stage | Actual server/API observation | Actual DOM observation |
| --- | --- | --- |
| Baseline | Draft contains `ORDER OLD X` | X; `已保存` |
| Local edit | No save yet | `ORDER SAVED A`; `有未保存修改` |
| Refresh started | Real draft GET returns X, versions GET returns 2 entries; both 200 responses held before delivery | Refresh busy; save enabled; confirmation accepted |
| Save completes while refresh held | PUT returns A (200), save readback GET returns A (200) | A; `已保存`; refresh still busy |
| Old refresh released | Previously captured X response is delivered | X; `已保存`; save disabled; publish enabled |
| Fresh verification | Fresh API GET and direct SQLite read both contain A | UI remains X |

The script delays actual responses with Playwright `route.fetch()` and then releases the captured responses using `route.fulfill({ response })`. It does not invent response content or replace the component's state. The fresh final API request bypasses the page route interceptor.

The working copy is directly observed through the controlled input DOM. The saved baseline being reverted to X is inferred from the dirty status returning to `已保存`, the disabled save button, and the content-comparison code; internal React state was not read directly. No publish action was invoked.

## Evidence

- `repro-edge.cjs`: executable red regression and isolated database/server/browser lifecycle.
- `result.json`: DOM snapshots, HTTP status/title observations, ordered event trace, and `pass: false`.
- `01-old-x-baseline.png` through `05-stale-refresh-overwrites-a.png`: five real Edge screenshots. `04` shows saved A while refresh is busy; `05` shows X after the old refresh, with `已保存` still shown.
- `regression-error.txt`: expected A vs actual X assertion failure.
- `cleanup.json`: closed browser, disconnected Prisma client, stopped owned server, closed port 3012, deleted temporary database and WAL/SHM files.

## Replay

Prerequisites for the original red sequence: a pre-repair `.next` build from `751cd4e`, installed project dependencies, the supplied clean source database, bundled runtime Playwright, Edge at the path in the script, and free port 3012. On the repaired build, the save button is disabled while refresh waits, so this original sequence cannot proceed. Use `acceptance-edge.cjs` for current regression verification. The self-contained runner starts the local Next CLI with an independent `DATABASE_URL`.

From the worktree root:

```powershell
node docs/evidence/2026-10-01-home-operation-order/repro-edge.cjs
```

Actual independent replay exited **1** with:

```text
RED: a completed save must survive an older refresh response
+ actual - expected

+ 'ORDER OLD X'
- 'ORDER SAVED A'
```

This was reproduced twice: once through the Node REPL and once through the standalone script. Final evidence files are from the standalone replay. `CODEY_RUNTIME_MODULES` and `CODEY_SOURCE_DB` can override the two machine-specific prerequisite paths. The test always copies the source database, changes only that temporary copy, and deletes the copy after closing its server.

## Root cause and smallest repair direction

`src/components/admin/HomeWorkspace.tsx:212` fetches a draft and versions concurrently, then unconditionally applies draft metadata, saved baseline, and versions at lines 218–221. Refresh and save can overlap because their busy keys and button disable conditions are independent (refresh lines 230–235/333; save lines 253–259/347).

`src/components/admin/home/content-editor.ts:148` only asks whether the current content differs from the content captured when the request started. In this reproduction, refresh starts with local A; after A is saved, current content is still A. The equality check therefore accepts old X. `setSavedContent(nextContent)` then accepts X unconditionally, causing the UI to treat X as saved despite the persisted A.

Minimal repair suggestion: assign an operation generation when an accepted refresh/save/publish/rollback begins, and ignore an older operation's response before applying **any** draft/content/savedContent/version state. Keep the existing comparison that preserves edits made during the latest request. Reserve the generation before a mutation request, rather than only at its later readback. Apply the same guard to rollback's separate response path. This suggestion is not implemented here.

## Limits

This task used the existing `.next` build and did not rebuild it; HEAD is source provenance, not independently verified build provenance. The reproduction covers refresh → save/readback → stale refresh in field editing. Other operation pairings, visual editing, and a repaired implementation were not tested. The saved baseline conclusion is an inference from actual DOM and current code. All accesses were local; production, merge, deployment, and publishing were outside this task.

## Implemented repair and review

The root agent reused `useAdminAction`'s synchronous active-key protection with one shared `home:operation` key for refresh, save, publish, and restore. This prevents overlapping server operations from beginning and covers preview flush, mutation, and all readback. Existing per-operation keys retain their loading labels and feedback. Content inputs remain editable, and existing reconciliation preserves new edits. Restore now captures its content baseline after preview flush. No global hook or other workspace behavior changed.

Fresh root verification: 83 test files / 557 tests passed, TypeScript and full ESLint passed, independent migrated SQLite production build passed (56 pages), and the root replay of the 7-scenario repaired browser runner exited 0. The root reviewed the changed component, active-key cleanup, nested feedback handling, cancel/error paths, modal state, and the browser assertions. The independent read-only review attempt did not receive its task body and produced no review evidence.

Remaining boundaries: the restore modal prevents normal background typing, so the restore-new-input case remains unproven; synthetic composition is not real Windows IME. Full F4 UI/knowledge review, static-image publication policy, production migration/rollback compatibility, and release scope/server checks remain open.
