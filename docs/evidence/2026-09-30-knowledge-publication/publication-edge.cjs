/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local evidence runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const zlib = require('node:zlib');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');

const repo = path.resolve(__dirname, '../../..');
const runId = crypto.randomUUID();
const ownedTemp = path.join(os.tmpdir(), 'workstation-knowledge-publication-' + runId);
const output = path.join(__dirname, 'run-' + runId);
const baseURL = 'http://127.0.0.1:3015';
const redOnly = process.argv.includes('--capture-red');
const results = { runId, startedAt: new Date().toISOString(), assertions: [], events: [], requestFailed: [], pageErrors: [], screenshots: [] };
let db, server, browser, releaseHeld;
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const portFree = () => new Promise((resolve) => {
  const probe = net.createServer(); probe.once('error', () => resolve(false));
  probe.listen(3015, '127.0.0.1', () => probe.close(() => resolve(true)));
});
function png(red, green, blue) {
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, bytes) => { const name = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(bytes.length); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(Buffer.concat([name, bytes]))); return Buffer.concat([len, name, bytes, sum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(160, 0); header.writeUInt32BE(100, 4); header[8] = 8; header[9] = 2;
  const rows = Buffer.alloc(100 * (1 + 160 * 3));
  for (let y = 0; y < 100; y++) for (let x = 0; x < 160; x++) { const p = y * 481 + 1 + x * 3; rows[p] = red; rows[p + 1] = green; rows[p + 2] = blue; }
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
async function check(name, work, detail = {}) {
  try { await work(); results.assertions.push({ name, pass: true, ...detail }); }
  catch (error) { results.assertions.push({ name, pass: false, classification: error.code === 'ERR_ASSERTION' ? 'business-assertion' : 'fixture-or-wait', error: error.message, actual: error.actual, expected: error.expected, ...detail }); }
}
async function snapshot(page, label) {
  const dom = await page.evaluate(() => ({ title: document.title, text: document.body.innerText,
    viewer: document.querySelector('section[aria-label="笔记正文"]')?.textContent ?? null,
    revisionIds: [...document.querySelectorAll('[id^="revision-"]')].map((n) => n.id),
    inputs: [...document.querySelectorAll('input,select')].map((n) => ({ tag: n.tagName, name: n.name, aria: n.getAttribute('aria-label'), value: n.value, disabled: n.disabled })),
    buttons: [...document.querySelectorAll('button')].map((n) => ({ text: n.textContent, disabled: n.disabled })),
    images: [...document.images].map((n) => ({ src: n.getAttribute('src'), complete: n.complete, naturalWidth: n.naturalWidth })),
    viewport: { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth } }));
  await fs.writeFile(path.join(output, label + '-dom.json'), JSON.stringify(dom, null, 2) + '\n');
  await page.screenshot({ path: path.join(output, label + '.png'), fullPage: true });
  const viewer = page.getByRole('region', { name: '笔记正文', exact: true });
  if (await viewer.count()) await viewer.screenshot({ path: path.join(output, label + '-viewer.png') });
  results.screenshots.push(label + '.png'); return dom;
}
async function captureDatabase(label, vaultId) {
  const data = await db.knowledgeVault.findUnique({ where: { id: vaultId }, include: { notes: true, noteLinks: true, sourceRevisions: { include: { draft: { include: { attachments: true, article: { include: { attachments: true } } } } } }, syncReports: { include: { changes: true } } } });
  await fs.writeFile(path.join(output, label + '-db.json'), JSON.stringify(data, null, 2) + '\n'); return data;
}
async function run() {
  await fs.mkdir(output, { recursive: true });
  assert.equal(await portFree(), true, '3015 must be free; never stop or reuse an unowned process');
  await fs.mkdir(ownedTemp); await fs.writeFile(path.join(ownedTemp, 'owner.json'), JSON.stringify({ runId, purpose: 'knowledge-publication' }));
  const databasePath = path.join(ownedTemp, 'test.db');
  await fs.copyFile(process.env.CODEY_SOURCE_DB || 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db', databasePath);
  const requireRuntime = createRequire(path.join(process.env.CODEY_RUNTIME_MODULES || 'C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', 'package.json'));
  const requireRepo = createRequire(path.join(repo, 'package.json'));
  const { chromium } = requireRuntime('playwright'); const { PrismaClient } = requireRepo('@prisma/client');
  const databaseURL = 'file:' + databasePath.replaceAll('\\', '/');
  db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
  results.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
  results.buildId = (await fs.readFile(path.join(repo, '.next/BUILD_ID'), 'utf8')).trim();
  results.sourceHashes = {};
  for (const file of ['src/components/admin/knowledge-scan-update.ts', 'src/app/admin/admin.module.css']) results.sourceHashes[file] = sha(await fs.readFile(path.join(repo, file)));
  for (const file of ['src/components/admin/KnowledgeWorkspace.tsx', 'src/components/admin/useAdminAction.ts', 'src/lib/services/knowledge-vaults.ts', 'src/lib/services/knowledge-publications.ts', 'src/lib/services/knowledge-articles.ts', 'src/lib/services/knowledge-draft-attachments.ts', 'src/lib/services/knowledge-sync-reviews.ts', 'src/lib/services/assets.ts', 'src/lib/backup/paths.ts', 'src/lib/knowledge/article-attachment-snapshots.ts']) results.sourceHashes[file] = sha(await fs.readFile(path.join(repo, file)));
  try {
    for (const model of ['knowledgeCollectionArticle', 'knowledgeArticleAttachment', 'knowledgeArticle', 'knowledgePublicationDraftAttachment', 'knowledgeAttachmentTransferRequest', 'knowledgePublicationDraft', 'knowledgeVault']) await db[model].deleteMany();
    const user = await db.user.create({ data: { username: 'publication-' + runId, passwordHash: 'not-a-login-password', isActive: true } });
    const token = crypto.randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 3600000) } });
    const storage = { uploads: path.join(ownedTemp, 'uploads'), snapshots: path.join(ownedTemp, 'article-attachments') };
    server = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3015'], { cwd: repo, env: { ...process.env, DATABASE_URL: databaseURL, UPLOAD_DIR: storage.uploads, ARTICLE_ATTACHMENT_DIR: storage.snapshots }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server-startup-timeout')), 15000); server.once('error', (e) => { clearTimeout(timer); reject(e); }); server.once('exit', (code) => { clearTimeout(timer); reject(new Error('server-exited-' + code)); }); server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Ready')) { clearTimeout(timer); resolve(); } }); });
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    results.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: 'workstation_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const tasks = new Set();
    const watch = (p) => { p.on('pageerror', (e) => results.pageErrors.push(e.message)); p.on('requestfailed', (r) => results.requestFailed.push({ endpoint: new URL(r.url()).pathname, method: r.method(), error: r.failure()?.errorText })); p.on('response', (r) => { const endpoint = new URL(r.url()).pathname; if (!endpoint.startsWith('/api/admin/knowledge')) return; const task = r.json().then((data) => results.events.push({ endpoint, method: r.request().method(), status: r.status(), data })).catch((e) => results.events.push({ endpoint, error: e.message })); tasks.add(task); task.finally(() => tasks.delete(task)); }); };
    watch(page);
    const api = async (method, endpoint, data) => { const r = await context.request.fetch(baseURL + endpoint, { method, data }); const body = await r.json(); assert.ok(r.ok(), method + ' ' + endpoint + ' status=' + r.status()); results.events.push({ source: 'fixture-api', endpoint, method, status: r.status(), data: body }); return body; };
    const responseFor = (endpoint, method) => page.waitForResponse((r) => new URL(r.url()).pathname === endpoint && r.request().method() === method);
    const act = async (endpoint, method, action) => { const pending = responseFor(endpoint, method); pending.catch(() => {}); await action(); const response = await pending; const body = await response.json(); assert.ok(response.ok(), endpoint + ' status=' + response.status()); await response.finished(); return body; };
    const assets = [];
    for (const [name, bytes] of [['publication-red.png', png(180, 45, 45)], ['publication-blue.png', png(40, 85, 185)]]) {
      const r = await context.request.post(baseURL + '/api/admin/assets', { multipart: { file: { name, mimeType: 'image/png', buffer: bytes }, altTextZh: name } }); assert.equal(r.status(), 201);
      const asset = await r.json(); assert.ok(path.resolve(asset.storagePath).startsWith(path.resolve(storage.uploads) + path.sep)); assets.push({ ...asset, bytes });
    }
    const source = '---\ntitle: Publication Evidence\nsummary: Isolated snapshot verification\ntags: [evidence]\n---\n\n# SOURCE VERSION ONE\n\nPUBLICATION_BODY_ONE\n\n![[picture.png]]\n';
    const makeVault = async (name, markdown) => { const root = path.join(ownedTemp, name); await fs.mkdir(root); await fs.writeFile(path.join(root, 'note.md'), markdown); await fs.writeFile(path.join(root, 'picture.png'), assets[0].bytes); const vault = await api('POST', '/api/admin/knowledge/vaults', { name, rootPath: root, ignorePatterns: [], enabled: true }); return { ...vault, root }; };
    const normal = await makeVault('Normal Publication Vault', source);
    await page.goto(baseURL + '/admin/knowledge', { waitUntil: 'domcontentloaded' });
    let indexed = await act('/api/admin/knowledge/vaults/' + normal.id + '/scan', 'POST', () => page.getByRole('button', { name: '扫描知识库', exact: true }).first().click());
    await page.getByRole('button', { name: '查看笔记', exact: true }).click();
    const viewer = page.getByRole('region', { name: '笔记正文', exact: true });
    await viewer.getByText('PUBLICATION_BODY_ONE', { exact: true }).waitFor();
    await snapshot(page, '01-desktop-note-before-draft');
    let storedArticle, publicPage;
    if (redOnly) {
      const pending = responseFor('/api/admin/knowledge/publications/drafts', 'POST');
      await viewer.getByRole('button', { name: '创建发布草稿', exact: true }).click();
      const response = await pending; const payload = await response.json(); await response.finished();
      await page.getByRole('alert').filter({ hasText: 'Unknown argument' }).waitFor();
      results.imageDraftFailure = { status: response.status(), payload };
      const data = await captureDatabase('02-image-draft-api-failure', normal.id);
      await snapshot(page, '02-image-draft-api-failure');
      await check('image-draft-api-returns-success-and-ui-shows-created-draft', async () => {
        assert.equal(response.status(), 201, 'real image draft creation must succeed');
        assert.equal(await viewer.getByText('草稿：Publication Evidence', { exact: true }).count(), 1);
      }, { persistedDraftIds: data.sourceRevisions.filter((r) => r.draft).map((r) => r.draft.id), error: payload.error });
      await check('failed-image-draft-keeps-original-markdown', async () => assert.equal(await fs.readFile(path.join(normal.root, 'note.md'), 'utf8'), source));
      results.normalLoopBlockedByImageDraftFailure = true;
    } else {
    const createDraftButton = viewer.getByRole('button', { name: '创建发布草稿', exact: true });
    const draft = await act('/api/admin/knowledge/publications/drafts', 'POST', () => createDraftButton.click());
    await check('image-draft-queues-one-valid-transfer', async () => {
      const transfers = await db.knowledgeAttachmentTransferRequest.findMany({ where: { draftId: draft.id } });
      assert.equal(transfers.length, 1); assert.equal(transfers[0].target, 'picture.png');
      assert.equal(transfers[0].sourceRevisionId, indexed.sourceRevisions[0].id); assert.equal(transfers[0].vaultId, normal.id);
    });
    const row = page.locator('#revision-' + indexed.sourceRevisions[0].id);
    await row.locator('select').waitFor();
    await act('/api/admin/knowledge/publications/attachments', 'POST', () => row.locator('select').selectOption(assets[0].id));
    await row.getByRole('textbox', { name: '文章路径', exact: true }).fill('publication-normal');
    await check('desktop-publication-controls-use-readable-width', async () => {
      const size = await row.boundingBox(), viewerSize = await viewer.boundingBox();
      const button = await row.getByRole('button', { name: '发布文章', exact: true }).boundingBox();
      assert.ok(size.width > viewerSize.width * 0.8); assert.ok(button.height < 50);
    });
    const article = await act('/api/admin/knowledge/articles', 'POST', () => row.getByRole('button', { name: '发布文章', exact: true }).click());
    await snapshot(page, '02-desktop-published');
    await check('normal-draft-and-source-unchanged', async () => { assert.equal(await fs.readFile(path.join(normal.root, 'note.md'), 'utf8'), source); assert.equal((await db.knowledgePublicationDraft.findUniqueOrThrow({ where: { id: draft.id } })).markdown, source); });
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); publicPage = await publicContext.newPage(); watch(publicPage);
    const publicResponse = await publicPage.goto(baseURL + '/knowledge/publication-normal'); assert.equal(publicResponse.status(), 200);
    await publicPage.getByText('PUBLICATION_BODY_ONE', { exact: true }).waitFor(); await publicPage.locator('article img').evaluate((img) => img.decode());
    await snapshot(publicPage, '03-desktop-public-snapshot');
    storedArticle = await db.knowledgeArticle.findUniqueOrThrow({ where: { id: article.id }, include: { attachments: true } });
    const attachmentURL = '/api/knowledge/article-attachments/' + storedArticle.attachments[0].id;
    const actualImageURL = await publicPage.locator('article img').getAttribute('src');
    await check('normal-public-image-and-independent-snapshot', async () => { assert.equal(storedArticle.attachments.length, 1); assert.ok(path.resolve(storedArticle.attachments[0].storagePath).startsWith(path.resolve(storage.snapshots) + path.sep)); const r = await publicContext.request.get(baseURL + actualImageURL); assert.equal(r.status(), 200); assert.equal(sha(await r.body()), sha(assets[0].bytes)); assert.equal(sha(await fs.readFile(storedArticle.attachments[0].storagePath)), sha(assets[0].bytes)); }, { actualImageURL, guessedAttachmentURLUnused: attachmentURL });
    const changed = source.replace('SOURCE VERSION ONE', 'SOURCE VERSION TWO').replace('PUBLICATION_BODY_ONE', 'PUBLICATION_BODY_TWO');
    await fs.writeFile(path.join(normal.root, 'note.md'), changed);
    indexed = await act('/api/admin/knowledge/vaults/' + normal.id + '/scan', 'POST', () => page.getByRole('button', { name: '扫描知识库', exact: true }).click());
    await viewer.getByText('PUBLICATION_BODY_TWO', { exact: true }).waitFor();
    await publicPage.reload(); await publicPage.getByText('PUBLICATION_BODY_ONE', { exact: true }).waitFor();
    await check('rescan-keeps-published-snapshot', async () => { const current = await db.knowledgeArticle.findUniqueOrThrow({ where: { id: article.id } }); assert.equal(current.markdown, storedArticle.markdown); assert.ok(!current.markdown.includes('PUBLICATION_BODY_TWO')); assert.equal(await fs.readFile(path.join(normal.root, 'note.md'), 'utf8'), changed); });
    await act('/api/admin/knowledge/sync-changes/' + indexed.syncReports[0].changes[0].id + '/review', 'PATCH', () => page.getByRole('button', { name: '确认变更', exact: true }).click());
    await check('review-persists-without-changing-public-article', async () => { const change = await db.knowledgeSyncChange.findUniqueOrThrow({ where: { id: indexed.syncReports[0].changes[0].id } }); assert.equal(change.reviewDecision, 'ACKNOWLEDGED'); assert.equal((await db.knowledgeArticle.findUniqueOrThrow({ where: { id: article.id } })).markdown, storedArticle.markdown); });
    await page.setViewportSize({ width: 375, height: 900 }); await snapshot(page, '04-mobile-rescanned-source');
    await row.getByRole('button', { name: '下架文章', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '下架已发布文章', exact: true }); await snapshot(page, '05-mobile-unpublish-confirm');
    await act('/api/admin/knowledge/articles/' + article.id, 'DELETE', () => dialog.getByRole('button', { name: '确认下架', exact: true }).click());
    await snapshot(page, '06-mobile-draft-preserved');
    await check('mobile-publication-controls-fit-viewport', async () => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      const button = await row.getByRole('button', { name: '发布文章', exact: true }).boundingBox();
      assert.ok(button.x >= 0 && button.x + button.width <= 375); assert.ok(button.height < 50);
    });
    await check('unpublish-removes-public-page-and-image-keeps-draft-selection', async () => { assert.equal(await db.knowledgeArticle.count({ where: { id: article.id } }), 0); assert.equal(await db.knowledgePublicationDraft.count({ where: { id: draft.id } }), 1); assert.equal((await db.knowledgePublicationDraftAttachment.findFirstOrThrow({ where: { draftId: draft.id } })).assetId, assets[0].id); assert.equal(await row.locator('select').inputValue(), assets[0].id); assert.equal((await publicContext.request.get(baseURL + '/knowledge/publication-normal')).status(), 404); assert.equal((await publicContext.request.get(baseURL + actualImageURL)).status(), 404); assert.equal(await fs.stat(storedArticle.attachments[0].storagePath).then(() => true, () => false), false); });
    const republished = await act('/api/admin/knowledge/articles', 'POST', () => row.getByRole('button', { name: '发布文章', exact: true }).click());
    await publicPage.setViewportSize({ width: 375, height: 900 }); await publicPage.reload(); await publicPage.getByText('PUBLICATION_BODY_ONE', { exact: true }).waitFor(); await publicPage.locator('article img').evaluate((img) => img.decode());
    await snapshot(page, '07-mobile-republished'); await snapshot(publicPage, '08-mobile-public');
    await check('republish-creates-new-article-with-original-draft', async () => { assert.notEqual(republished.id, article.id); assert.equal((await db.knowledgeArticle.findUniqueOrThrow({ where: { id: republished.id } })).draftId, draft.id); assert.equal(await fs.readFile(path.join(normal.root, 'note.md'), 'utf8'), changed); });
    await captureDatabase('normal-final', normal.id);
    }

    const race = await makeVault('Race Publication Vault', redOnly ? source.replace('![[picture.png]]\n', '') : source);
    await api('POST', '/api/admin/knowledge/vaults/' + race.id + '/scan');
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.reload();
    await page.getByRole('button', { name: race.name }).click(); await page.getByRole('button', { name: '查看笔记', exact: true }).click(); await viewer.getByText('PUBLICATION_BODY_ONE', { exact: true }).waitFor();
    const card = page.getByRole('complementary', { name: '已登记知识库' }).locator('article').filter({ has: page.getByRole('button', { name: race.name }) });
    const held = deferred(), ready = deferred(); releaseHeld = held.resolve;
    await page.route('**/api/admin/knowledge/vaults/' + race.id + '/scan', async (route) => { const response = await route.fetch(); assert.equal(response.status(), 200); results.heldScanPayload = await response.json(); ready.resolve(); await held.promise; await route.fulfill({ response }); }, { times: 1 });
    const scanFinished = responseFor('/api/admin/knowledge/vaults/' + race.id + '/scan', 'POST');
    scanFinished.catch(() => {});
    await card.getByRole('button', { name: '扫描知识库', exact: true }).click(); await ready.promise;
    results.scanDelayInjection = 'route.fetch completed real server scan before holding unmodified response; UI mutation succeeds before release';
    const raceDraft = await act('/api/admin/knowledge/publications/drafts', 'POST', () => viewer.getByRole('button', { name: '创建发布草稿', exact: true }).click());
    await snapshot(page, '09-race-draft-created-before-old-scan'); await captureDatabase('09-race-before-release', race.id);
    held.resolve(); await (await scanFinished).finished(); await page.waitForLoadState('networkidle'); releaseHeld = null;
    const afterScan = await snapshot(page, '10-race-old-scan-overwrites-draft'); const raceDatabase = await captureDatabase('10-race-after-release', race.id);
    await check('old-scan-response-retains-successfully-created-draft', async () => { assert.ok(raceDatabase.sourceRevisions.some((r) => r.draft?.id === raceDraft.id), 'database must contain successful draft'); assert.ok(afterScan.viewer.includes('草稿：Publication Evidence'), 'UI must retain successful draft after older scan response'); }, { injection: results.scanDelayInjection, databaseDraftId: raceDraft.id });
    if (redOnly) {
      await check('race-original-markdown-unchanged', async () => assert.equal(await fs.readFile(path.join(race.root, 'note.md'), 'utf8'), source.replace('![[picture.png]]\n', '')));
      await Promise.all([...tasks]); results.captureCompleted = true; results.assertionsPassed = results.assertions.every((a) => a.pass); process.exitCode = results.assertionsPassed ? 0 : 1; return;
    }

    await page.reload(); await page.getByRole('button', { name: race.name }).click(); await page.getByRole('button', { name: '查看笔记', exact: true }).click(); await viewer.getByText('PUBLICATION_BODY_ONE', { exact: true }).waitFor();
    const raceRow = page.locator('#revision-' + raceDraft.sourceRevisionId);
    await raceRow.getByRole('button', { name: '选择文章附件', exact: true }).click(); await raceRow.locator('select').waitFor();
    const saveHeld = deferred(), saveReady = deferred(); releaseHeld = saveHeld.resolve;
    await page.route('**/api/admin/knowledge/publications/attachments', async (route) => { const response = await route.fetch(); assert.equal(response.status(), 200); results.heldAttachmentPayload = await response.json(); saveReady.resolve(); await saveHeld.promise; await route.fulfill({ response }); }, { times: 1 });
    const attachmentFinished = responseFor('/api/admin/knowledge/publications/attachments', 'POST');
    attachmentFinished.catch(() => {});
    await raceRow.locator('select').selectOption(assets[0].id); await saveReady.promise;
    const allowed = { selectEnabled: await raceRow.locator('select').isEnabled(), publishEnabled: await raceRow.getByRole('button', { name: /^(发布文章|发布中)$/ }).isEnabled() };
    if (!allowed.selectEnabled || !allowed.publishEnabled) {
      await check('pending-attachment-blocks-conflicting-selection-and-publication', async () => {
        assert.equal(allowed.selectEnabled, false); assert.equal(allowed.publishEnabled, false);
        assert.equal(await db.knowledgeArticle.count({ where: { draftId: raceDraft.id } }), 0);
      }, { allowed });
      await snapshot(page, '11-race-attachment-controls-guarded');
      saveHeld.resolve(); await (await attachmentFinished).finished(); releaseHeld = null;
      await raceRow.locator('select').waitFor({ state: 'visible' });
      await page.waitForFunction((id) => !document.querySelector('#revision-' + id + ' select')?.disabled, raceDraft.sourceRevisionId);
      await act('/api/admin/knowledge/publications/attachments', 'POST', () => raceRow.locator('select').selectOption(assets[1].id));
      await page.waitForFunction(({ id, asset }) => document.querySelector('#revision-' + id + ' select')?.value === asset && !document.querySelector('#revision-' + id + ' select')?.disabled, { id: raceDraft.sourceRevisionId, asset: assets[1].id });
    } else {
      await raceRow.locator('select').selectOption(assets[1].id);
    }
    await raceRow.getByRole('textbox', { name: '文章路径', exact: true }).fill('publication-race');
    const raceArticle = await act('/api/admin/knowledge/articles', 'POST', () => raceRow.getByRole('button', { name: '发布文章', exact: true }).click());
    await snapshot(page, '11-race-published-with-attachment-save-held');
    if (releaseHeld) { saveHeld.resolve(); await (await attachmentFinished).finished(); releaseHeld = null; }
    await page.waitForLoadState('networkidle');
    await snapshot(page, '12-race-attachment-save-released');
    const raceFinal = await captureDatabase('12-race-final', race.id);
    storedArticle = await db.knowledgeArticle.findUniqueOrThrow({ where: { id: raceArticle.id }, include: { attachments: true } });
    await publicPage.setViewportSize({ width: 1440, height: 1000 }); await publicPage.goto(baseURL + '/knowledge/publication-race'); await publicPage.locator('article img').evaluate((img) => img.decode()); await snapshot(publicPage, '13-race-public-old-attachment');
    await check('attachment-pending-control-retains-latest-user-selection', async () => { const chosen = raceFinal.sourceRevisions.find((r) => r.draft?.id === raceDraft.id).draft.attachments[0]; assert.equal(chosen.assetId, assets[1].id, 'latest accepted choice must be blue'); assert.equal(storedArticle.attachments[0].sha256, sha(assets[1].bytes), 'publish after blue choice must use latest selected image'); const imageURL = await publicPage.locator('article img').getAttribute('src'); const imageResponse = await publicPage.context().request.get(baseURL + imageURL); assert.equal(imageResponse.status(), 200); assert.equal(sha(await imageResponse.body()), sha(assets[1].bytes)); }, { allowed, injection: allowed.selectEnabled ? 'real first attachment response held while enabled controls accept blue/publication' : 'real first attachment response held; conflicting controls disabled; after release blue saves before publication', firstAssetId: assets[0].id, lastUserChoiceAssetId: assets[1].id, publishedSnapshotDigest: storedArticle.attachments[0].sha256 });
    await Promise.all([...tasks]);
    results.captureCompleted = true;
    results.assertionsPassed = results.assertions.every((a) => a.pass);
    results.requestFailedClassification = results.requestFailed.reduce((acc, item) => { acc[item.error] = (acc[item.error] || 0) + 1; return acc; }, {});
    process.exitCode = results.assertionsPassed ? 0 : 1;
  } catch (error) { results.infrastructureError = { message: error.message, stack: error.stack }; process.exitCode = 2; }
  finally {
    if (releaseHeld) releaseHeld();
    if (browser) await browser.close();
    results.requestFailedClassification = results.requestFailed.reduce((acc, item) => { acc[item.error] = (acc[item.error] || 0) + 1; return acc; }, {});
    if (db) await db.$disconnect();
    if (server && server.exitCode === null && server.signalCode === null) { const exited = new Promise((resolve) => server.once('exit', resolve)); server.kill(); await exited; }
    const tempRoot = await fs.realpath(os.tmpdir()); const target = await fs.realpath(ownedTemp);
    const owner = JSON.parse(await fs.readFile(path.join(target, 'owner.json'), 'utf8'));
    assert.equal(owner.runId, runId); assert.equal(owner.purpose, 'knowledge-publication');
    assert.ok(target.toLowerCase().startsWith(tempRoot.toLowerCase() + path.sep)); assert.equal(path.basename(target), 'workstation-knowledge-publication-' + runId);
    await fs.rm(target, { recursive: true });
    results.cleanup = { browserClosed: !browser || !browser.isConnected(), databaseDisconnected: true, ownedServerExited: !server || server.exitCode !== null || server.signalCode !== null, port3015Free: await portFree(), verifiedOwnedTempDeleted: await fs.stat(target).then(() => false, () => true) };
    results.completedAt = new Date().toISOString(); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify({ output, captureCompleted: results.captureCompleted, assertions: results.assertions, infrastructureError: results.infrastructureError?.message, cleanup: results.cleanup }, null, 2));
  }
}
run().catch((error) => { console.error(error.message); process.exitCode = 2; });
