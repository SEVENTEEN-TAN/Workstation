# Knowledge vault selection lifecycle evidence

Current result: **4 / 4 selection checks and 4 / 4 scan checks passed**. The root ran both modes against the repaired production build; latest selection results are in [green-ea984410-2691-4b4a-aeba-c186d19eb7bd](green-ea984410-2691-4b4a-aeba-c186d19eb7bd/results.json), and scan results are documented below. Original RED evidence is preserved.

## Original pre-repair reproduction phase

The original reproduction used HEAD `11cff68013298a031bd2c2185e13c42c19848e9f`, its supplied production `.next` build, and real local Edge `154.0.4258.37`. Business source was not changed during that phase. Only local disposable SQLite copies and temporary Vault directories were used.

## Findings

| User action | Actual selected index | Actual viewer | Fresh API / database evidence |
| --- | --- | --- | --- |
| View A, register empty C through the UI | C Empty Vault | A title and A properties remain; `Note unavailable` | POST returned C with no notes/revisions. Automatic GET C/notes?path=same.md returned 400. C note count is zero. |
| View A again, confirm removal of A | B Selection Vault | A title and A properties appear with B body and B source revision | DELETE A returned 200; A registration count became zero. Automatic GET B/notes?path=same.md returned B content. Fresh B GET and stored B revision match. A local source remained unchanged. |

A and B each contain a real `same.md` with different frontmatter titles, marker properties, and bodies. Both were registered and indexed through the actual authenticated API; database records show one note and one `LOCAL_SCAN` revision per Vault. No note-read responses were mocked or rewritten.

## Evidence

- First observation: `observe-36d13cfa-cddd-47d3-9aaa-f6c4f1f75873/`, containing baseline, addition, confirmation and removal screenshots, DOM JSON, and `results.json`.
- RED rerun: `red-3e31887c-5e9a-4cbd-b5e0-cc776db0afba/`, containing the same evidence plus independent expected-viewer-cleared assertions.
- Addition image: `red-3e31887c-5e9a-4cbd-b5e0-cc776db0afba/02-add-empty-selected-viewer.png`.
- Cross-vault image: `red-3e31887c-5e9a-4cbd-b5e0-cc776db0afba/05-remove-a-fallback-b-viewer.png`.

Both RED assertions failed with `ERR_ASSERTION`, actual `true`, expected `false`; exit code was 1. Capture completed, there was no infrastructure error, and page error arrays were empty. The failures are actual viewer-presence assertions after completed API/UI actions, not timeout failures. The first failure does not prevent running or asserting the second scenario.

## Reproduce

Run from the worktree root, after providing its production `.next` build and keeping port 3012 free:

```powershell
& 'C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' docs/evidence/2026-09-30-knowledge-vault-selection/repro-edge.cjs --assert
```

Omit `--assert` to capture observations without applying the expected-viewer-cleared assertions. Every run creates a fresh evidence directory; prior RED evidence is retained. The runner uses an explicit Edge executable and `createRequire` from the bundled runtime Node packages. `CODEY_SOURCE_DB` and `CODEY_RUNTIME_MODULES` can override the supplied database/runtime locations. Session tokens are generated and used in memory only, and are omitted from evidence.

For the repaired build, use `node docs/evidence/2026-09-30-knowledge-vault-selection/repro-edge.cjs --green`. This adds checks for removing an unselected Vault without disturbing the current B note, and removing B when it was automatically selected through fallback (`selectedId` is empty), then selecting an empty D. Each check records and asserts whether a viewer should be present; no response content is mocked. The original two RED checks require a pre-repair build to reproduce their failures.

## Repair and current verification

`KnowledgeWorkspace.tsx` now routes manual selection, successful registration, and removal of the current Vault through the same `selectVault` helper. It clears the old viewer and search query. Removal compares the actual selected Vault ID, so an automatically selected fallback is also handled; removing an unrelated Vault leaves its current note intact. The existing note effect cleanup ignores any obsolete response after the viewer is cleared. Failure paths return before changing selection.

The two original assertions and both additional fallback/unselected checks pass (exit 0); page errors are empty, and all owned-resource cleanup checks are true. Fresh API and database reads validate fixtures and registration removal; original local Markdown files remain unchanged. Latest results record the source digest for comparison with the component. Full regression: 83 files / 557 tests, TypeScript, ESLint and production build passed (56 pages), using the independent migrated SQLite build database. Publication/attachment/sync interleaving remains outside this verification.

## Same-note scan refresh and read retry

Run `node docs/evidence/2026-09-30-knowledge-vault-selection/repro-edge.cjs --scan --green` after rebuilding. The scan mode reuses disposable fixtures and records four checks:

1. Change the open note's title, properties and body, then scan through the UI: the viewer must show the new metadata and body together. Fresh scan API and source-revision DB reads verify the updated fixture.
2. Inject one controlled HTTP 500 for the note read, then scan again: the successful read must clear the previous error and show the body. Only this failure response is synthetic.
3. Remove the fixture Markdown and scan: the note disappears from the index and the viewer closes.
4. Hold the response of an actual A scan after its server work, select and open B, then release A: B's title/body remain selected. The delayed response content is unchanged.

On `5c98109`, [scan RED](scan-red-f5443ce8-2dad-4cf3-acff-d81197fda06e/results.json) captured three independent assertion failures (old title, stale read error, removed viewer retained); the fourth check passed. Exit 1 was not an infrastructure timeout. The scanner replaces note rows, so reconciliation uses Vault ID and relative path rather than the previous note ID.

The repair rebinds the open note to the scan result or closes it when missing. Note content/error now belongs to the exact Vault index and viewed note object; an obsolete response cannot appear under a new index or viewer, and pending reads display loading state. Existing effect cancellation remains in place. [Final scan GREEN](scan-green-da1fbacb-4e9a-4396-a1b6-6ef438b74c63/results.json) passes all four checks, exit 0, no page errors, all owned-resource cleanup checks true. The updated viewer screenshot was visually inspected. The original selection mode was then rerun on the same build and passed all four checks.

The intermediate `scan-green-9d3340c9-fdf9-4674-931f-52030efdc54b` is a failed verification attempt, not a completion result: the retry snapshot was taken while the new note request was still loading. The runner now waits for that actual response and for loading to end before asserting. That correction changed test synchronization only; no additional business change was made between that attempt and final GREEN.

After the repair: full 83-file / 557-test suite, TypeScript, full ESLint, and the isolated migrated SQLite production build (56 pages) passed. This does not cover concurrent publication/attachment/review writes or production behavior.

## Original reproduction validation and cleanup

- The standalone evidence script passed targeted ESLint (exit 0).
- Both completed runs closed their Edge browser, disconnected Prisma, stopped only their own server, and verified port 3012 was free.
- Both deleted only their own randomized temporary parent directory after checking its resolved path is inside Temp and its owner marker matches the current run. That directory contained the copied DB and all three test Vaults.
- The original supplied source DB, business source, other evidence folders, and `.serena` were preserved.
- During the original reproduction phase, no business fix, commit, deployment, or production verification was performed. The subsequent repair and its verification are documented above. Scan-induced same-note metadata refresh remains untested.

Root cause matches `KnowledgeWorkspace.tsx`: `createVault` changes selected ID at line 162; `removeVault` changes fallback selection at line 183; neither clears `viewingNote`. The effect at lines 114–122 reads the old note relative path under the newly selected Vault. The manual Vault selector at line 329 already clears `viewingNote`.
