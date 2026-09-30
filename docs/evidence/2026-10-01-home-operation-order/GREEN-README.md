# Repaired homepage operation acceptance

Result: **7 / 7 scenarios passed** in real headless Microsoft Edge `154.0.4258.37`, at `1440 × 1440`, against an independent temporary SQLite copy and generated local test session. The root agent independently replayed the complete runner and confirmed exit 0. Actual time of the latest replay is recorded in `green-results.json`; this directory's existing date label was retained.

The runner used the repaired production `.next` build supplied by the root agent. It did not rebuild or rerun the full suite. HEAD at acceptance was `751cd4e07053f23c5913e35287fc2e474720511a`; the homepage source repair was uncommitted, so `green-results.json` also records the current `HomeWorkspace.tsx` source digest. HEAD alone does not identify the repaired source. Original red screenshots, `result.json`, `cleanup.json`, and `regression-error.txt` were preserved. `repro-edge.cjs` only gained a documented CJS lint exemption.

## Checks

| Scenario | Verified result |
| --- | --- |
| Refresh holds actual draft and versions GET responses | Refresh/save/publish controls and all history restore controls disabled. Edit A → B remains possible. Releasing old X preserves B as unsaved; saving B then makes UI, fresh API, and SQLite agree. |
| Save holds actual readback GET responses | PUT has persisted A before readback delivery. Other server operations remain disabled. New B stays in the working copy and remains unsaved; API/SQLite stay A until the next save persists B. |
| Publish holds actual readback GET responses | Other server operations remain disabled. New B survives readback and router refresh as unsaved. Published SQLite record and saved draft retain A until explicit subsequent save of B. |
| Restore holds actual POST, then actual versions GET response | Refresh/save/publish, history restore, confirm, and cancel are disabled in both stages. Escape cannot close the busy modal. Once released, modal closes and UI/API/SQLite agree with the returned draft. |
| Simulated refresh GET 500 | Error feedback appears, controls unlock, an eligible history restore control unlocks, and a second refresh succeeds. |
| Simulated save PUT 500 | Error feedback appears, controls unlock, an eligible history restore control unlocks, and a second save succeeds with API/SQLite agreement. |
| Visual preview flush waits before HTTP | Synthetic composition events defer the actual iframe flush acknowledgement. Refresh/save/publish are disabled while no site API request has started. Composition end releases flush; PUT/readback succeeds and API/SQLite agree. |

Response delays use `route.fetch()` to capture actual server responses, then `route.fulfill({ response })` after an explicit gate release. Only the two failure checks invent HTTP 500 responses. Fresh API checks use `context.request` and bypass page interceptors. Direct Prisma reads verify the same test database.

## Visual and deterministic evidence

- `acceptance-edge.cjs`: independently runnable repaired-build acceptance and owned resource lifecycle.
- `green-results.json`: exactly 7 scenarios, 7 passes, no page script errors, ordered response and DOM observations, source provenance, and limitations.
- `green-cleanup.json`: closed browser, disconnected Prisma client, stopped owned server, confirmed port 3012 closed, and deleted temporary database plus WAL/SHM files.
- 18 `green-*.png` screenshots. Inspected representative images: `green-02-refresh-held.png`, `green-06-save-b-preserved.png`, `green-10-rollback-versions-held.png`, and `green-13-visual-flush-held.png`. They show pending actions, retained unsaved B, the busy restore modal, and save waiting for preview flush.
- Targeted ESLint for both CJS runners exited 0. The initial acceptance attempt stopped at a test selector that also matched Next's route announcer; it was narrowed to the actual simulated-error text. The final complete run exited 0.

## Replay

Requires free local port 3012, an existing repaired `.next` production build, project dependencies, the clean source database, bundled Playwright, and Edge at the script's configured path.

```powershell
node docs/evidence/2026-10-01-home-operation-order/acceptance-edge.cjs
npx eslint docs/evidence/2026-10-01-home-operation-order/acceptance-edge.cjs docs/evidence/2026-10-01-home-operation-order/repro-edge.cjs
```

`CODEY_SOURCE_DB` and `CODEY_RUNTIME_MODULES` override the same prerequisite paths as the original red runner. Replay rewrites only the `green-*` results/screenshots, uses a fresh temporary database, and cleans its own server/browser/database. Generated session tokens remain in memory and are not logged or saved.

## Limits

The restore confirmation is a native modal throughout POST and versions readback (`:modal` verified). Background editing is not an available user path in this state. This run therefore **does not prove restore response reconciliation while the user continues typing**. The visual flush test uses synthetic composition events and **does not constitute real Windows Chinese IME acceptance**. Only the current homepage operation mutex was accepted; this does not close the entire F4 review, establish production migration/rollback compatibility, or authorize merge/deployment.
