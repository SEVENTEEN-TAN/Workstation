/* eslint-disable @typescript-eslint/no-require-imports -- Standalone isolated browser evidence. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..'), runId = crypto.randomUUID();
const prefix = 'workstation-feedback-order-', temp = path.join(os.tmpdir(), prefix + runId), output = path.join(__dirname, 'run-' + runId);
const port = 3018, base = 'http://127.0.0.1:' + port;
const results = { runId, startedAt: new Date().toISOString(), assertions: [], events: [], pageErrors: [], failedRequests: [], screenshots: [] };
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.once('error', () => resolve(false)); s.listen(port, '127.0.0.1', () => s.close(() => resolve(true))); });
let db, server, browser;
const pendingGates = new Set();
async function check(name, work) { try { await work(); results.assertions.push({ name, pass: true }); } catch (e) { results.assertions.push({ name, pass: false, error: e.message, classification: e.code === 'ERR_ASSERTION' ? 'business-assertion' : 'fixture-or-wait' }); console.log(JSON.stringify({ name, error: e.message })); } }
async function capture(page, name) { await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }); results.screenshots.push(name + '.png'); }
async function main() {
  await fs.mkdir(output, { recursive: true }); assert.equal(await freePort(), true, 'Occupied port; never stop an unowned service');
  await fs.mkdir(temp); await fs.writeFile(path.join(temp, 'owner.json'), JSON.stringify({ runId, purpose: 'feedback-order' }));
  await fs.copyFile(process.env.SOURCE_DB || 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db', path.join(temp, 'test.db'));
  const { PrismaClient } = createRequire(path.join(root, 'package.json'))('@prisma/client');
  const { chromium } = createRequire('C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json')('playwright');
  const databaseURL = 'file:' + path.join(temp, 'test.db').replaceAll('\\', '/'); db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
  try {
    results.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
    results.buildId = (await fs.readFile(path.join(root, '.next/BUILD_ID'), 'utf8')).trim(); results.sourceHashes = {};
    for (const file of ['src/components/admin/useAdminAction.ts', 'src/components/admin/KnowledgeWorkspace.tsx', 'src/components/admin/knowledge-scan-update.ts', 'src/lib/services/knowledge-vaults.ts', 'src/lib/services/knowledge-articles.ts', 'src/lib/services/knowledge-sync-reviews.ts']) results.sourceHashes[file] = sha(await fs.readFile(path.join(root, file)));
    const user = await db.user.create({ data: { username: 'feedback-' + runId, passwordHash: 'unused-isolated-session' } });
    const token = crypto.randomBytes(32).toString('base64url'); await db.session.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 3600000) } });
    server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: root, env: { ...process.env, DATABASE_URL: databaseURL, UPLOAD_DIR: path.join(temp, 'uploads'), ARTICLE_ATTACHMENT_DIR: path.join(temp, 'attachments') }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server-startup-timeout')), 15000); server.once('error', (e) => { clearTimeout(timer); reject(e); }); server.once('exit', (c) => { clearTimeout(timer); reject(new Error('server-exited-' + c)); }); server.stdout.on('data', (c) => { if (c.toString().includes('Ready')) { clearTimeout(timer); resolve(); } }); });
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true }); results.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: 'workstation_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('pageerror', (e) => results.pageErrors.push(e.message)); page.on('requestfailed', (r) => results.failedRequests.push({ endpoint: new URL(r.url()).pathname, error: r.failure()?.errorText }));
    const api = async (method, endpoint, data) => { const response = await context.request.fetch(base + endpoint, { method, data }); const body = await response.json(); assert.ok(response.ok(), endpoint + ' ' + response.status()); return body; };
    const responseFor = (endpoint, method) => page.waitForResponse((r) => new URL(r.url()).pathname === endpoint && r.request().method() === method);
    const act = async (endpoint, method, work) => { const waiting = responseFor(endpoint, method); waiting.catch(() => {}); await work(); const response = await waiting; const data = await response.json(); await response.finished(); results.events.push({ endpoint, method, status: response.status() }); assert.ok(response.ok(), endpoint + ' ' + response.status()); return data; };
    const vaultRoot = path.join(temp, 'vault'); await fs.mkdir(vaultRoot);
    const markdown = '---\ntitle: Feedback Evidence\nsummary: Isolated test\n---\n\n# BODY_ONE\n'; await fs.writeFile(path.join(vaultRoot, 'note.md'), markdown);
    const vault = await api('POST', '/api/admin/knowledge/vaults', { name: 'Feedback Vault ' + runId, rootPath: vaultRoot, ignorePatterns: [], enabled: true });
    const scanEndpoint = '/api/admin/knowledge/vaults/' + vault.id + '/scan';
    const scanned = await api('POST', scanEndpoint); const revisionId = scanned.sourceRevisions[0].id;
    const draft = await api('POST', '/api/admin/knowledge/publications/drafts', { sourceRevisionId: revisionId });
    const open = async () => { await page.goto(base + '/admin/knowledge', { waitUntil: 'networkidle' }); await page.getByRole('button', { name: vault.name }).click(); await page.getByRole('button', { name: '查看笔记', exact: true }).click(); await page.getByRole('region', { name: '笔记正文', exact: true }).getByText('BODY_ONE', { exact: true }).waitFor(); };
    const row = page.locator('#revision-' + revisionId);
    const scanCard = page.getByRole('complementary', { name: '已登记知识库' }).locator('article').filter({ has: page.getByRole('button', { name: vault.name }) });
    let scanGate = null, publicationGate = null;
    // Keep both interceptors registered throughout: changing route patterns while
    // a request is held can resume a Chromium interception before our release.
    await page.route('**' + scanEndpoint, async (route) => {
      const gate = scanGate; scanGate = null;
      if (!gate) return route.continue();
      try { const response = await route.fetch(); assert.equal(response.status(), 200); const body = await response.json(); gate.ready.resolve(); await gate.held.promise; await route.fulfill({ status: 200, json: body }); }
      catch (e) { results.events.push({ routeError: e.message, stage: 'scan' }); }
    });
    await page.route('**/api/admin/knowledge/articles', async (route) => {
      if (route.request().method() !== 'POST' || !publicationGate) return route.continue();
      const gate = publicationGate; publicationGate = null;
      try { gate.ready.resolve(); await gate.held.promise; await route.fulfill({ status: 500, json: { error: 'EVIDENCE_PUBLICATION_FAILED' } }); }
      catch (e) { results.events.push({ routeError: e.message, stage: 'publication' }); }
    });
    const heldScan = async () => {
      const ready = deferred(), held = deferred(); pendingGates.add(held.resolve); scanGate = { ready, held };
      const waiting = responseFor(scanEndpoint, 'POST'); waiting.catch(() => {});
      await scanCard.getByRole('button', { name: '扫描知识库', exact: true }).click(); await ready.promise;
      return async () => { held.resolve(); await (await waiting).finished(); await page.waitForFunction((button) => !button.disabled, await scanCard.getByRole('button', { name: '扫描知识库', exact: true }).elementHandle()); pendingGates.delete(held.resolve); };
    };
    const failPublish = async () => {
      const ready = deferred(), held = deferred(); held.resolve(); publicationGate = { ready, held };
      const waiting = responseFor('/api/admin/knowledge/articles', 'POST'); waiting.catch(() => {});
      await row.getByRole('button', { name: '发布文章', exact: true }).click(); const response = await waiting; assert.equal(response.status(), 500); await response.finished();
      await page.getByRole('alert').filter({ hasText: 'EVIDENCE_PUBLICATION_FAILED' }).waitFor();
    };
    await open(); await row.getByRole('textbox', { name: '文章路径', exact: true }).fill('feedback-' + runId);
    await check('newer-publication-error-survives-older-scan-success', async () => {
      const release = await heldScan(); await failPublish(); await capture(page, '01-error-before-scan'); await release();
      await capture(page, '02-after-old-scan'); assert.equal(await page.getByRole('alert').filter({ hasText: 'EVIDENCE_PUBLICATION_FAILED' }).count(), 1);
      assert.equal(await db.knowledgeArticle.count({ where: { draftId: draft.id } }), 0);
    });
    for (const release of pendingGates) release(); pendingGates.clear();
    await open(); await page.setViewportSize({ width: 375, height: 900 }); await row.getByRole('textbox', { name: '文章路径', exact: true }).fill('feedback-' + runId);
    await check('older-success-timer-does-not-clear-newer-error', async () => {
      const release = await heldScan(); const ready = deferred(), held = deferred(); pendingGates.add(held.resolve); publicationGate = { ready, held };
      const waiting = responseFor('/api/admin/knowledge/articles', 'POST'); waiting.catch(() => {});
      await row.getByRole('button', { name: '发布文章', exact: true }).click(); await ready.promise; await release();
      const scanReleasedAt = Date.now(); held.resolve(); await (await waiting).finished(); await page.getByRole('alert').filter({ hasText: 'EVIDENCE_PUBLICATION_FAILED' }).waitFor();
      // Wait beyond the hook's four-second success timer to test its observable lifetime.
      await page.waitForTimeout(Math.max(0, 4300 - (Date.now() - scanReleasedAt)));
      await capture(page, '03-mobile-error-after-old-timer'); assert.equal(await page.getByRole('alert').filter({ hasText: 'EVIDENCE_PUBLICATION_FAILED' }).count(), 1); pendingGates.delete(held.resolve);
    });
    for (const release of pendingGates) release(); pendingGates.clear();
    await open(); await row.getByRole('textbox', { name: '文章路径', exact: true }).fill('feedback-' + runId); let article;
    await check('old-scan-retains-successful-publication-and-newer-feedback', async () => {
      const release = await heldScan(); article = await act('/api/admin/knowledge/articles', 'POST', () => row.getByRole('button', { name: '发布文章', exact: true }).click());
      await row.getByText('已发布：/' + article.slug, { exact: true }).waitFor(); await release();
      assert.equal(await row.getByText('已发布：/' + article.slug, { exact: true }).count(), 1); assert.equal((await context.request.get(base + '/knowledge/' + article.slug)).status(), 200);
      assert.equal(await page.getByRole('status').filter({ hasText: '文章已发布，公开内容已固定为当前草稿快照' }).count(), 1); await capture(page, '04-mobile-published-after-old-scan');
    });
    for (const release of pendingGates) release(); pendingGates.clear();
    assert.ok(article, 'publication prerequisite');
    await check('old-scan-retains-successful-unpublication-and-newer-feedback', async () => {
      const release = await heldScan(); await row.getByRole('button', { name: '下架文章', exact: true }).click(); const dialog = page.getByRole('dialog', { name: '下架已发布文章', exact: true });
      await act('/api/admin/knowledge/articles/' + article.id, 'DELETE', () => dialog.getByRole('button', { name: '确认下架', exact: true }).click()); await dialog.waitFor({ state: 'hidden' }); await release();
      assert.equal(await row.getByRole('button', { name: '发布文章', exact: true }).count(), 1); assert.equal((await context.request.get(base + '/knowledge/' + article.slug)).status(), 404);
      assert.equal(await db.knowledgeArticle.count({ where: { draftId: draft.id } }), 0); assert.equal(await db.knowledgePublicationDraft.count({ where: { id: draft.id } }), 1);
      assert.equal(await page.getByRole('status').filter({ hasText: '文章已下架，发布草稿和已选附件已保留' }).count(), 1); await capture(page, '05-mobile-unpublished-after-old-scan');
    });
    for (const release of pendingGates) release(); pendingGates.clear();
    await fs.writeFile(path.join(vaultRoot, 'note.md'), markdown.replace('BODY_ONE', 'BODY_TWO')); await api('POST', scanEndpoint); await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/admin/knowledge', { waitUntil: 'networkidle' }); await page.getByRole('button', { name: vault.name }).click();
    const change = await db.knowledgeSyncChange.findFirstOrThrow({ where: { report: { vaultId: vault.id }, reviewDecision: null, type: 'MODIFIED' } });
    await check('old-scan-retains-successful-source-review', async () => {
      const release = await heldScan(); await act('/api/admin/knowledge/sync-changes/' + change.id + '/review', 'PATCH', () => page.locator('#sync-change-' + change.id).getByRole('button', { name: '确认变更', exact: true }).click()); await release();
      assert.equal((await db.knowledgeSyncChange.findUniqueOrThrow({ where: { id: change.id } })).reviewDecision, 'ACKNOWLEDGED');
      assert.equal(await page.getByRole('status').filter({ hasText: '已确认源变更；公开内容未被修改' }).count(), 1); await capture(page, '06-desktop-review-after-old-scan');
    });
    results.completed = true; results.passed = results.assertions.length === 5 && results.assertions.every((a) => a.pass) && !results.events.some((event) => event.routeError); process.exitCode = results.passed ? 0 : 1;
  } catch (e) { results.infrastructureError = { message: e.message, stack: e.stack }; process.exitCode = 2; }
  finally {
    for (const release of pendingGates) release(); if (browser) await browser.close(); if (db) await db.$disconnect();
    if (server && server.exitCode === null && server.signalCode === null) { const ended = new Promise((r) => server.once('exit', r)); server.kill(); await ended; }
    const target = await fs.realpath(temp), tempRoot = await fs.realpath(os.tmpdir()); assert.equal(path.dirname(target).toLowerCase(), tempRoot.toLowerCase()); assert.equal(path.basename(target), prefix + runId);
    const owner = JSON.parse(await fs.readFile(path.join(target, 'owner.json'), 'utf8')); assert.equal(owner.runId, runId); assert.equal(owner.purpose, 'feedback-order'); await fs.rm(target, { recursive: true });
    results.cleanup = { browserClosed: !browser || !browser.isConnected(), databaseDisconnected: true, ownedServerExited: !server || server.exitCode !== null || server.signalCode !== null, port3018Free: await freePort(), ownedTempDeleted: await fs.stat(target).then(() => false, () => true) };
    results.failureClassification = results.failedRequests.reduce((a, v) => { a[v.error] = (a[v.error] || 0) + 1; return a; }, {});
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n'); console.log(JSON.stringify({ output, assertions: results.assertions, error: results.infrastructureError?.message, cleanup: results.cleanup }, null, 2));
  }
}
main().catch((e) => { console.error(e.message); process.exitCode = 2; });
