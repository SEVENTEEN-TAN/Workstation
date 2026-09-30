# Knowledge publication runtime evidence

## Latest GREEN verification

Main-agent run: `run-2beb8d5b-6c39-43b3-8100-17bcc99f7b90`.
Base HEAD: `5b90b88ac084d49b60e142ff68703a21847c9f07`, with the fixes below in the working tree.
Production Build ID: `3cSgVmoC3_35aT2WGajlO`.
Real Windows Edge at 1440 x 1000 and 375 x 900; **12 assertion groups passed**, exit 0.
Main agent verified all 12 recorded source hashes and the Build ID against current files.
Top-level `results.json` contains this latest run; retained historical runs have separate results.

- Image draft creation and exactly one valid image transfer request now succeed.
- Real UI selection/publication, anonymous article/image reads and independent image snapshot bytes pass.
  Source-change rescan and review preserve the original public snapshot.
- Mobile unpublish removes the public page, image endpoint and snapshot file, while retaining
  the draft and selected attachment; republish creates a new article from that same draft.
- Holding a real older scan response through successful draft creation no longer removes the draft from UI.
- While a real attachment response is held, both selection and publication are disabled.
  After release, selecting blue and publishing stores and anonymously serves the blue snapshot.
- Desktop revision controls occupy the viewer width; desktop/mobile publication buttons remain
  readable and the 375 px page does not overflow horizontally.

Repairs are limited to explicit Prisma transfer fields, scan-response reconciliation,
one shared operation key per draft, and scoped revision-panel layout.
The scan merge uses the state at request start: only local draft/review changes completed during
that scan override its response. New scan revisions and unmodified server state remain accepted.
Five regression tests cover draft creation, attachment/publication, unpublish, review, and fresh server state.

Independent read-only review (`knowledge_fix_evidence_review_v16`) inspected the reconciliation,
operation keys/guards, explicit Prisma fields, scoped CSS, tests, result JSON and the three screenshot
samples listed below. No evidenced P1/P2 regression or material gap within this bounded change was found;
the reviewer considers this batch ready to commit. This is not approval of the whole branch or deployment.
The main agent checked the actual diff and final evidence before staging.

Business-code checks: 84 files / 562 tests, full ESLint, TypeScript production build
with the existing isolated migrated SQLite database, 56 generated pages.
The final layout change was additionally checked through actual browser geometry and build.

The main agent visually inspected the latest guarded desktop viewer, mobile retained-draft viewer,
and mobile public article. This is a sample, not a claim to have opened every latest image.
All 8 original RED screenshots were inspected by the evidence agent.
Historical screenshot filenames containing `overwrites`, `held`, or `old-attachment` name the original
fault scenario; GREEN shows retained draft, publication after release, and the blue image.
The mobile viewer crop can include the fixed success toast at its top; DOM/DB assertions independently
verify the draft and attachment state.

Latest run: 31 recorded knowledge API events, no pageerror, 83 requestfailed entries, all
`net::ERR_ABORTED` including prefetch/navigation/shutdown. This does not mean every request succeeded.
Owned Edge/server/Prisma/Temp cleanup all passed; port 3015 is free.

## Additional attachment RED and runner debugging

`run-620ffd54-bb2a-4071-99a3-11368518c066` was captured after the first two fixes:
7 groups passed, attachment latest-choice assertion failed. Both controls stayed enabled while
the first save response was held; the later blue selection was silently skipped by the per-target
operation key and the published image was red. Shared per-draft mutual exclusion fixes that failure.

One subsequent runner attempt looked up `发布文章` while the shared busy state displayed `发布中`.
That locator timeout is an infrastructure error, not another business defect. Pending responses
now have immediate rejection handlers, and the guarded locator accepts both real labels.
The task-owned orphan Temp was removed after resolved parent, exact name and owner identity checks;
incomplete screenshots and a superseded GREEN were removed after exact evidence-path checks.
The final complete GREEN and both complete RED runs are retained.

Remaining boundaries: real Windows IME, other public-component/CSS combinations, server preflight,
deployment and production migration/rollback remain outside this evidence. Scan with attachment,
publish/unpublish or review has reconciliation regression cases; the real held-scan browser scenario
specifically covers draft creation. This is not server stress, complete keyboard/accessibility,
multi-image transfer or failure-atomicity verification.

## Original RED verified state

Run: `run-44d2cfd3-e6f6-4b08-b265-54c43798a69d`.
HEAD: `5b90b88ac084d49b60e142ff68703a21847c9f07`.
Existing production Build ID: `dSWTfnTKi3ugfbSgQSNbZ`.
Real headless Windows Edge: `154.0.4258.37`; viewport 1440 x 1000.
Source digests, unmodified held scan payload, API responses, classifications and
cleanup results are in the run's `results.json` (also copied to this directory).
No business source was changed in this evidence task.

Two business assertions failed; two source preservation assertions passed.
The run completed without infrastructure or waiting errors.

| Assertion | Actual evidence | Result |
| --- | --- | --- |
| Image draft creation returns 201 and appears in UI | Real API returns 400, `Unknown argument targets`; the draft row already exists in DB, UI still offers creation | RED |
| Older scan response preserves a later successful draft | Held scan contains `draft: null`; later draft POST returns 201; DB retains draft before and after release; UI reverts to creation after release | RED |
| Failed image draft preserves source Markdown | Exact bytes match the fixture after API failure | PASS |
| Interleaved scan and draft preserve source Markdown | Exact bytes match after release | PASS |

## Minimal reproduction

From this worktree:

```powershell
node docs/evidence/2026-09-30-knowledge-publication/publication-edge.cjs --capture-red
```

The runner requires the existing `.next`, the bundled Playwright runtime and
Edge. It refuses occupied port 3015. It copies the known migrated build database
into a freshly marked Temp directory, creates an in-memory session and real
PNG uploads, and sets `DATABASE_URL`, `UPLOAD_DIR`, `ARTICLE_ATTACHMENT_DIR` only
for its owned local child server. Original database and shared storage are never
written. Sessions/cookies are not serialized into evidence.

Image draft reproduction: scan one real Markdown file with `![[picture.png]]`,
open it, and click **创建发布草稿**. The source revision is real. The error comes
from `knowledge-publications.ts` spreading an input containing `targets` into
Prisma's transfer-request `create` data. DB evidence records the earlier draft
upsert that already succeeded.

Scan interleaving reproduction: use a separate real note without embeds so the
image transfer error does not prevent this independent check. Open the note,
start a real scan, use `route.fetch()` to finish server work and capture the real
200 response, then hold only delivery. While the scan response is held, click
**创建发布草稿** and wait for the real 201 response and DB persistence. Release
the unchanged scan response. The UI loses the successful draft while the DB
retains it. This is explicitly controlled response-order fault injection; no
successful response body is mocked and no timeout is treated as a defect.

## Artifact map and visual inspection

All eight PNG files in the completed run were opened and visually inspected:

| Full-page and corresponding `-viewer` image | Visual observation |
| --- | --- |
| `01-desktop-note-before-draft` | Image embed remains source syntax; original revision offers draft creation |
| `02-image-draft-api-failure` | Full-page image shows actual Prisma error feedback; viewer retains create button |
| `09-race-draft-created-before-old-scan` | Busy scan plus visible draft title, slug input and publish action |
| `10-race-old-scan-overwrites-draft` | Completed scan; draft controls gone and create button returns |

`02-image-draft-api-failure-db.json` proves the persisted image draft.
`09-race-before-release-db.json` and `10-race-after-release-db.json` prove the
same later draft persists on both sides of old-response delivery. Each screenshot
has a separate DOM JSON. The completed run's raw events include draft 201 and
held scan 200; `heldScanPayload` has no draft.

The desktop draft publish action wraps each character vertically within the
narrow inspector cell in screenshot 09. This is a visible layout concern,
not evaluated as an additional business assertion in this bounded task.

## Original RED limitations and runner modes

At the original RED snapshot, normal image publication, anonymous article/attachment reads, source-change
snapshot preservation, mobile 375 px unpublish/republish, and attachment-save
interleaving remain unverified because image draft creation failed first.
The default runner includes those checks for the main agent to execute after
repair and rebuild:

```powershell
node docs/evidence/2026-09-30-knowledge-publication/publication-edge.cjs
```

At that snapshot the default path was prepared, not passing. Latest GREEN supersedes this boundary. It holds a real attachment
save response, attempts a later enabled image choice and publication, and checks
the persisted choice and published image snapshot. If the repair disables
conflicting controls, the main agent must adapt the interleaving step to assert
that explicit guard and then complete the original latest-choice intent after
release. Do not count a disabled-control waiting timeout as a business failure.

## Network and cleanup

No page errors occurred. `requestfailed` entries were all `net::ERR_ABORTED`
for admin route prefetch/navigation, including browser shutdown; see the exact
counts in `requestFailedClassification`. This does not prove that all network
requests succeeded.

Completed-run cleanup proves: owned Edge closed, Prisma disconnected, owned
server exited, port 3015 free, and owned temporary root deleted only after
resolved Temp containment, exact prefix and `owner.json` identity checks.

Earlier development attempts exposed incorrect button/alert locators and were
discarded from the final evidence set. One initial unhandled pending-response
rejection terminated the runner; the owned child port was checked free and the
orphaned Temp directory removed only after identical ownership/path checks.
The current runner immediately handles pending response rejection and records
cleanup in `finally`. Those setup/waiting attempts are not business evidence.
