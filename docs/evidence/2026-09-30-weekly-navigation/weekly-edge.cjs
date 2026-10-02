/* eslint-disable @typescript-eslint/no-require-imports -- Isolated actual Edge navigation evidence. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..'), runId = crypto.randomUUID();
const prefix = 'workstation-weekly-navigation-', purpose = 'weekly-navigation';
const temp = path.join(os.tmpdir(), prefix + runId), output = path.join(__dirname, 'run-' + runId);
const port = 3019, base = 'http://127.0.0.1:' + port;
const results = { runId, startedAt: new Date().toISOString(), assertions: [], observations: [], dialogs: [], requests: [], pageErrors: [], failedRequests: [], screenshots: [] };
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
const freePort = () => new Promise(resolve => { const s = net.createServer(); s.once('error', () => resolve(false)); s.listen(port, '127.0.0.1', () => s.close(() => resolve(true))); });
let db, server, context, browser, tempOwned = false, currentCase = 'setup';
const serverLog = [];
async function ownedTemp() {
  const target = await fs.realpath(temp), tempRoot = await fs.realpath(os.tmpdir());
  assert.equal(path.dirname(target).toLowerCase(), tempRoot.toLowerCase()); assert.equal(path.basename(target), prefix + runId);
  assert.match(runId, /^[0-9a-f]{8}-[0-9a-f-]{27}$/);
  const owner = JSON.parse(await fs.readFile(path.join(target, 'owner.json'), 'utf8'));
  assert.equal(owner.runId, runId); assert.equal(owner.purpose, purpose); return { target, owner };
}
async function capture(page, name) { await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }); results.screenshots.push(name + '.png'); }
async function check(name, work) {
  if (process.env.HISTORY_ONLY && !name.includes(['fragment', 'legacy', 'boundary', 'reverted'].includes(process.env.HISTORY_ONLY) ? process.env.HISTORY_ONLY : 'navigation-' + (process.env.HISTORY_ONLY === 'native' ? 'true' : 'false'))) return;
  currentCase = name;
  const existingPages = new Set(context?.pages());
  try { await work(); results.assertions.push({ name, pass: true }); }
  catch (e) { results.assertions.push({ name, pass: false, error: e.message, classification: e.code === 'ERR_ASSERTION' ? 'business-assertion' : 'script-setup-or-wait' }); }
  finally { for (const page of context?.pages() || []) if (!existingPages.has(page)) await page.close(); }
  console.log(JSON.stringify(results.assertions.at(-1)));
}
async function main() {
  await fs.mkdir(output, { recursive: true });
  try {
    assert.equal(await freePort(), true, 'Occupied port; never stop an unowned process');
    await fs.mkdir(temp); tempOwned = true; await fs.writeFile(path.join(temp, 'owner.json'), JSON.stringify({ runId, purpose }));
    const sourceDB = process.env.SOURCE_DB || 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db';
    await fs.copyFile(sourceDB, path.join(temp, 'test.db')); results.sourceDatabaseSha256 = sha(await fs.readFile(sourceDB));
    results.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
    assert.equal(results.head, process.env.EXPECTED_HEAD || 'db4684132f50f43105cbac251cff23d87f8d1928');
    results.buildId = (await fs.readFile(path.join(root, '.next/BUILD_ID'), 'utf8')).trim(); results.sourceHashes = {};
    for (const file of ['src/app/layout.tsx', 'src/components/admin/WeeklyHistoryTracker.tsx', 'src/components/admin/WeeklyActivityWorkspace.tsx', 'src/components/admin/weekly-editor-state.ts', 'src/components/admin/AdminShell.tsx', 'src/components/admin/navigation.ts', 'src/components/admin/useAdminAction.ts', 'src/lib/services/weekly-activity-drafts.ts', 'src/app/api/admin/weekly/[id]/route.ts', 'prisma/schema.prisma']) results.sourceHashes[file] = sha(await fs.readFile(path.join(root, file)));
    const { PrismaClient } = createRequire(path.join(root, 'package.json'))('@prisma/client');
    const { chromium } = createRequire('C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json')('playwright');
    const databaseURL = 'file:' + path.join(temp, 'test.db').replaceAll('\\', '/'); db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
    const user = await db.user.create({ data: { username: 'weekly-' + runId, passwordHash: 'unused-isolated-session' } });
    const token = crypto.randomBytes(32).toString('base64url'); await db.session.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 3600000) } });
    const seed = async (label, start) => db.weeklyActivityDraft.create({ data: { weekStart: new Date(start), weekEnd: new Date(new Date(start).getTime() + 6 * 86400000), titleZh: label + '-' + runId, titleEn: label + ' isolated', summaryZh: '隔离周报原始摘要', summaryEn: 'Isolated original summary', sourceSnapshot: { github: [], progress: [], actions: [], projects: [], articles: [], activities: [] } } });
    // Far-future unique Mondays prevent collisions with the copied working data.
    let start = Date.UTC(2100, 0, 4) + (parseInt(runId.slice(0, 8), 16) % 5200) * 7 * 86400000;
    while (await db.weeklyActivityDraft.findUnique({ where: { weekStart: new Date(start) } })) start += 7 * 86400000;
    const first = await seed('导航证据 A', start), second = await seed('导航证据 B', start + 7 * 86400000);
    results.fixtures = [first, second]; const initial = await db.weeklyActivityDraft.findMany({ where: { id: { in: [first.id, second.id] } }, orderBy: { id: 'asc' } });
    server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: root, env: { ...process.env, DATABASE_URL: databaseURL, UPLOAD_DIR: path.join(temp, 'uploads'), ARTICLE_ATTACHMENT_DIR: path.join(temp, 'attachments') }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await fs.writeFile(path.join(temp, 'owner.json'), JSON.stringify({ runId, purpose, serverPid: server.pid, serverExecutable: process.execPath })); results.serverPid = server.pid;
    server.stderr.on('data', c => serverLog.push(c.toString()));
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server-startup-timeout')), 20000); server.once('error', e => { clearTimeout(timer); reject(e); }); server.once('exit', c => { clearTimeout(timer); reject(new Error('server-exited-' + c)); }); server.stdout.on('data', c => { serverLog.push(c.toString()); if (c.toString().includes('Ready')) { clearTimeout(timer); resolve(); } }); });
    context = await chromium.launchPersistentContext(path.join(temp, 'edge-profile'), { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, viewport: { width: 1440, height: 1000 } }); browser = context.browser(); results.browser = browser.version();
    await context.addCookies([{ name: 'workstation_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
    const makePage = async (width = 1440) => {
      const page = await context.newPage(); await page.setViewportSize({ width, height: 1000 }); page.setDefaultTimeout(10000); page.dialogDecision = 'accept';
      page.on('dialog', async dialog => { results.dialogs.push({ case: currentCase, type: dialog.type(), message: dialog.message(), decision: page.dialogDecision }); await dialog[page.dialogDecision](); });
      page.on('pageerror', e => results.pageErrors.push({ case: currentCase, message: e.message }));
      page.on('requestfailed', request => results.failedRequests.push({ case: currentCase, path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
      page.on('response', async response => { if (!new URL(response.url()).pathname.startsWith('/api/')) return; const request = response.request(); results.requests.push({ case: currentCase, path: new URL(response.url()).pathname, method: request.method(), status: response.status(), body: request.method() === 'PATCH' ? request.postDataJSON() : undefined }); });
      return page;
    };
    const ready = page => page.getByRole('heading', { name: '每周动态', exact: true }).waitFor();
    const card = (page, draft) => page.locator('article').filter({ has: page.getByRole('heading', { name: draft.titleZh, exact: true }) });
    const open = async (page, draft = first) => { await card(page, draft).getByRole('button', { name: '编辑', exact: true }).click(); await page.getByRole('textbox', { name: '中文标题', exact: true }).waitFor(); };
    const value = page => page.getByRole('textbox', { name: '中文标题', exact: true });
    const edit = async (page, text) => { await value(page).click(); await value(page).fill(text); await page.getByRole('button', { name: '保存草稿', exact: true }).waitFor({ state: 'visible' }); assert.equal(await value(page).inputValue(), text); };
    const visit = async (page, pathname = '/admin/weekly') => { await page.goto(base + pathname, { waitUntil: 'networkidle' }); if (pathname === '/admin/weekly') await ready(page); };
    const recovery = (page, draft = first) => page.evaluate(id => { const raw = sessionStorage.getItem('weekly-draft-recovery:' + id); return raw ? JSON.parse(raw) : null; }, draft.id);
    const disableStorage = page => page.evaluate(() => { window.evidenceSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('Evidence storage disabled', 'QuotaExceededError'); }; });
    const nav = async (page, label) => { if (page.viewportSize().width === 375) await page.getByRole('button', { name: '打开导航菜单', exact: true }).click(); await page.getByRole('link', { name: label, exact: true }).filter({ visible: true }).click(); };
    const unchanged = async () => assert.deepEqual(await db.weeklyActivityDraft.findMany({ where: { id: { in: [first.id, second.id] } }, orderBy: { id: 'asc' } }), initial);
    const baseline = await makePage(); await visit(baseline); await capture(baseline, '00-desktop-baseline'); await open(baseline); await capture(baseline, '01-desktop-editor-baseline'); await baseline.close();
    await check('draft-switch-dismiss-accept-and-reopen-recovery', async () => {
      const page = await makePage(); await visit(page); await open(page); const text = '未保存切换-' + runId; await edit(page, text);
      page.dialogDecision = 'dismiss'; await open(page, second); assert.equal(await value(page).inputValue(), text); assert.equal(results.dialogs.at(-1).type, 'confirm');
      page.dialogDecision = 'accept'; await open(page, second); assert.equal(await value(page).inputValue(), second.titleZh); await open(page, first); assert.equal(await value(page).inputValue(), text); assert.equal((await recovery(page)).values.titleZh, text);
      await capture(page, '02-switch-recovered'); await unchanged(); await page.close();
    });
    await check('true-reload-beforeunload-dismiss-accept-reopen-recovery-db-unchanged', async () => {
      const page = await makePage(); await visit(page); await open(page); const text = '未保存重载-' + runId; await edit(page, text);
      page.dialogDecision = 'dismiss'; const before = results.dialogs.length; const reloadError = await page.reload({ waitUntil: 'networkidle', timeout: 1500 }).then(() => null, e => e.message); assert.equal(results.dialogs.length, before + 1); assert.equal(results.dialogs.at(-1).type, 'beforeunload'); assert.equal(await value(page).inputValue(), text);
      results.observations.push({ case: currentCase, dismissedReloadError: reloadError }); page.dialogDecision = 'accept'; await page.reload({ waitUntil: 'networkidle' }); await ready(page); await open(page); assert.equal(await value(page).inputValue(), text); assert.equal((await recovery(page)).values.titleZh, text); await unchanged(); await capture(page, '03-reload-recovered'); await page.close();
    });
    for (const width of [1440, 375]) await check('sidebar-leave-dismiss-accept-return-recovery-' + width, async () => {
      const page = await makePage(width); await visit(page); await open(page); const text = '未保存路由-' + width + '-' + runId; await edit(page, text); page.dialogDecision = 'dismiss'; await nav(page, '仪表盘'); assert.equal(new URL(page.url()).pathname, '/admin/weekly'); assert.equal(await value(page).inputValue(), text);
      if (width === 375) await page.getByRole('button', { name: '关闭导航菜单', exact: true }).click(); page.dialogDecision = 'accept'; await nav(page, '仪表盘'); await page.waitForURL('**/admin/overview'); await page.getByRole('heading', { name: '仪表盘', exact: true }).waitFor(); await nav(page, '每周动态'); await page.waitForURL('**/admin/weekly'); await ready(page); await open(page); assert.equal(await value(page).inputValue(), text); await unchanged(); await capture(page, '04-sidebar-recovered-' + width); await page.close();
    });
    for (const nativeNavigation of [true, false]) for (const width of [1440, 375]) for (const storageFails of [false, true]) await check('actual-back-forward-cancel-retry-storage-' + (storageFails ? 'throws' : 'normal') + '-' + width + '-navigation-' + nativeNavigation, async () => {
      const page = await makePage(width);
      await page.addInitScript(() => {
        window.evidenceTraversalSettled = 0;
        window.evidenceHistoryEvents = [];
        window.navigation.addEventListener('navigate', event => { window.evidenceHistoryEvents.push({ type: event.navigationType, cancelable: event.cancelable, canIntercept: event.canIntercept, userInitiated: event.userInitiated, path: new URL(event.destination.url).pathname }); });
        window.navigation.addEventListener('navigateerror', () => { window.evidenceTraversalSettled += 1; });
        window.navigation.addEventListener('navigatesuccess', () => { window.evidenceTraversalSettled += 1; });
      });
      if (!nativeNavigation) await page.addInitScript(() => { window.evidenceNavigation = window.navigation; Object.defineProperty(window, 'navigation', { value: undefined, configurable: true }); });
      await visit(page, '/admin/overview'); await nav(page, '每周动态'); await ready(page);
      await nav(page, '仪表盘'); await page.waitForURL('**/admin/overview'); await nav(page, '每周动态'); await ready(page);
      await nav(page, '仪表盘'); await page.waitForURL('**/admin/overview'); await page.goBack(); await ready(page); await open(page);
      const history = () => page.evaluate(() => { const historyNavigation = window.evidenceNavigation || window.navigation; return { key: historyNavigation.currentEntry.key, index: historyNavigation.currentEntry.index, keys: historyNavigation.entries().map(entry => entry.key), fallbackPosition: window.history.state?.__weeklyEditorHistoryPosition ?? null }; });
      const originalHistory = await history(); if (storageFails) await disableStorage(page);
      const text = '未保存返回-' + storageFails + '-' + width + '-' + runId; await edit(page, text);
      const attempt = async (method, decision, blocked) => {
        // A history-menu selection is a fresh user gesture; activate the page
        // before the scripted multi-entry equivalent, too.
        await value(page).click();
        page.dialogDecision = decision; const start = results.dialogs.length;
        const settled = await page.evaluate(() => window.evidenceTraversalSettled);
        let waitError;
        if (method === 'goBackThree') {
          const dialog = page.waitForEvent('dialog', { timeout: 1500 }).then(() => null, e => e.message);
          await page.evaluate(() => window.history.go(-3)); waitError = await dialog;
        } else waitError = await page[method]({ waitUntil: 'domcontentloaded', timeout: 1500 }).then(() => null, e => e.message);
        results.observations.push({ case: currentCase, method, decision, blocked, waitError, originalHistory, historyImmediatelyAfter: await history(), actualUrl: page.url(), dialogCount: results.dialogs.length - start, recentEvents: await page.evaluate(() => window.evidenceHistoryEvents.slice(-6)) });
        assert.equal(results.dialogs.length, start + 1, 'History navigation must offer a cancelable dialog'); assert.equal(results.dialogs.at(-1).type, 'confirm');
        await page.waitForFunction(previous => window.evidenceTraversalSettled > previous, settled);
        if (blocked) { await page.waitForFunction(key => (window.evidenceNavigation || window.navigation).currentEntry.key === key, originalHistory.key); assert.equal(new URL(page.url()).pathname, '/admin/weekly'); assert.equal(await value(page).inputValue(), text); assert.deepEqual(await history(), originalHistory); }
        else { await page.waitForURL('**/admin/overview'); await page.getByRole('heading', { name: '仪表盘', exact: true }).waitFor(); }
        results.observations.push({ case: currentCase, method, decision, blocked, waitError, history: await history() });
      };
      await attempt('goBack', 'dismiss', true); await capture(page, '05-back-canceled-' + storageFails + '-' + width + '-' + nativeNavigation);
      await attempt('goBackThree', 'dismiss', true);
      if (storageFails) await attempt('goBackThree', 'accept', true);
      await attempt('goBack', 'accept', storageFails);
      if (storageFails) {
        await page.getByRole('status').filter({ hasText: '浏览器未能保留当前周报的修改' }).waitFor(); assert.equal(await recovery(page), null);
      } else { await page.goForward(); await ready(page); await open(page); assert.equal(await value(page).inputValue(), text); assert.deepEqual(await history(), originalHistory); }
      await attempt('goForward', 'dismiss', true); await attempt('goForward', 'accept', storageFails);
      if (storageFails) {
        assert.equal(await recovery(page), null); await capture(page, '06-history-storage-block-' + width + '-' + nativeNavigation);
        await page.evaluate(() => { Storage.prototype.setItem = window.evidenceSetItem; });
        await attempt('goForward', 'accept', false);
      }
      await page.goBack(); await ready(page); await open(page); assert.equal(await value(page).inputValue(), text); assert.equal((await recovery(page)).values.titleZh, text); assert.deepEqual(await history(), originalHistory);
      await capture(page, '06-history-recovered-' + storageFails + '-' + width + '-' + nativeNavigation); await unchanged(); await page.close();
    });
    for (const nativeNavigation of [true, false]) await check('legacy-history-after-reload-cancel-storage-failure-navigation-' + nativeNavigation, async () => {
      const page = await makePage();
      if (!nativeNavigation) await page.addInitScript(() => { window.evidenceNavigation = window.navigation; Object.defineProperty(window, 'navigation', { value: undefined, configurable: true }); });
      await visit(page, '/admin/overview');
      // An old implementation's Next entry has its original Next tree and __NA,
      // but predates our position field. Bypass the new wrapper to create that
      // legacy entry, then really reload the later weekly document.
      await page.evaluate(() => { const legacy = { ...history.state }; delete legacy.__weeklyEditorHistoryPosition; History.prototype.replaceState.call(history, legacy, ''); });
      await nav(page, '每周动态'); await ready(page); await page.reload({ waitUntil: 'networkidle' }); await ready(page); await open(page); await disableStorage(page);
      const text = '旧历史刷新保留-' + runId; await edit(page, text); page.dialogDecision = 'dismiss'; const before = results.dialogs.length;
      const dialog = page.waitForEvent('dialog', { timeout: 1500 }).then(() => null, error => error.message);
      const waitError = await page.goBack({ waitUntil: 'domcontentloaded', timeout: 1500 }).then(() => null, error => error.message);
      const dialogError = await dialog;
      results.observations.push({ case: currentCase, waitError, dialogError, actualUrl: page.url(), dialogs: results.dialogs.slice(before) });
      assert.equal(results.dialogs.length, before + 1, 'Legacy Back must not silently unload dirty input'); assert.equal(await value(page).inputValue(), text); assert.equal(await recovery(page), null);
      if (nativeNavigation) { await page.waitForURL('**/admin/weekly'); assert.equal(new URL(page.url()).pathname, '/admin/weekly'); }
      else {
        // Old engines cannot expose the old entry's distance. The URL has
        // moved, but Next must not replace this dirty editor until it is saved
        // or explicitly discarded; the visible notice explains that outcome.
        await page.getByRole('status').filter({ hasText: '保存或取消编辑后，会继续返回' }).waitFor();
        await capture(page, '11-legacy-pending-input-retained'); page.dialogDecision = 'accept'; await page.getByRole('button', { name: '取消', exact: true }).click();
        await page.getByRole('heading', { name: '仪表盘', exact: true }).waitFor();
      }
      await unchanged(); await capture(page, '11-legacy-reload-retained-' + nativeNavigation); await page.close();
    });
    await check('legacy-unmarked-history-without-navigation-save-then-resume', async () => {
      const third = await seed('旧历史保存证据', start + 14 * 86400000);
      const page = await makePage(); await page.addInitScript(() => { window.evidenceNavigation = window.navigation; Object.defineProperty(window, 'navigation', { value: undefined, configurable: true }); });
      await visit(page, '/admin/overview'); await page.evaluate(() => { const legacy = { ...history.state }; delete legacy.__weeklyEditorHistoryPosition; History.prototype.replaceState.call(history, legacy, ''); });
      await nav(page, '每周动态'); await ready(page); await page.reload({ waitUntil: 'networkidle' }); await ready(page); await open(page, third); await disableStorage(page);
      const text = '旧历史先保存-' + runId; await edit(page, text); await page.goBack({ waitUntil: 'domcontentloaded', timeout: 1500 }).catch(() => null);
      await page.getByRole('status').filter({ hasText: '保存或取消编辑后，会继续返回' }).waitFor(); assert.equal(await value(page).inputValue(), text); assert.equal(await recovery(page, third), null);
      const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/admin/weekly/' + third.id && r.request().method() === 'PATCH');
      await page.getByRole('button', { name: '保存草稿', exact: true }).click(); assert.equal((await response).status(), 200);
      await page.getByRole('heading', { name: '仪表盘', exact: true }).waitFor(); assert.equal((await db.weeklyActivityDraft.findUniqueOrThrow({ where: { id: third.id } })).titleZh, text);
      await page.goForward(); await ready(page); await page.reload({ waitUntil: 'networkidle' }); await ready(page); await open(page, { ...third, titleZh: text }); assert.equal(await value(page).inputValue(), text);
      await capture(page, '12-legacy-saved-return'); await unchanged(); await page.close();
    });
    await check('legacy-fragment-back-forward-without-navigation-keeps-editor-until-discard', async () => {
      const page = await makePage(); await page.addInitScript(() => { window.evidenceNavigation = window.navigation; Object.defineProperty(window, 'navigation', { value: undefined, configurable: true }); });
      await visit(page);
      await page.evaluate(() => {
        const legacy = { ...history.state }; delete legacy.__weeklyEditorHistoryPosition;
        History.prototype.replaceState.call(history, legacy, '', '#old');
        History.prototype.pushState.call(history, legacy, '', '#current');
      });
      await page.reload({ waitUntil: 'networkidle' }); await ready(page); await open(page); await disableStorage(page);
      const text = '旧片段历史保留-' + runId; await edit(page, text); page.dialogDecision = 'dismiss'; const before = results.dialogs.length;
      const dialog = page.waitForEvent('dialog', { timeout: 1500 }).then(() => null, error => error.message);
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 1500 }).catch(() => null);
      const dialogError = await dialog;
      results.observations.push({ case: currentCase, dialogError, actualUrl: page.url(), dialogs: results.dialogs.slice(before) });
      assert.equal(results.dialogs.length, before + 1, 'Unknown legacy fragment must not receive an invented forward position');
      await page.getByRole('status').filter({ hasText: '保存或取消编辑后，会继续返回' }).waitFor();
      assert.equal(await value(page).inputValue(), text); assert.equal(await recovery(page), null);
      await page.goForward({ waitUntil: 'domcontentloaded', timeout: 1500 }).catch(() => null); await page.waitForURL('**/admin/weekly#current');
      assert.equal(await value(page).inputValue(), text);
      page.dialogDecision = 'accept'; await page.getByRole('button', { name: '取消', exact: true }).click();
      await value(page).waitFor({ state: 'hidden' });
      await nav(page, '仪表盘'); await page.getByRole('heading', { name: '仪表盘', exact: true }).waitFor();
      await page.goBack(); await ready(page); await open(page); assert.equal(await value(page).inputValue(), first.titleZh);
      await unchanged(); await capture(page, '13-legacy-fragment-resumed'); await page.close();
    });
    await check('fallback-fragment-multi-traverse-keeps-input-until-discard', async () => {
      const page = await makePage(); await page.addInitScript(() => { window.evidenceNavigation = window.navigation; Object.defineProperty(window, 'navigation', { value: undefined, configurable: true }); });
      await visit(page, '/admin/overview'); await nav(page, '每周动态'); await ready(page); await open(page); await disableStorage(page);
      const text = '片段历史保留-' + runId; await edit(page, text); await page.evaluate(() => { location.hash = 'weekly-evidence'; }); await page.waitForURL('**/admin/weekly#weekly-evidence');
      await page.getByRole('status').filter({ hasText: '保存或取消编辑后，会继续返回' }).waitFor();
      const originalKeys = await page.evaluate(() => window.evidenceNavigation.entries().map(entry => entry.key));
      await page.evaluate(() => window.history.go(-2)); await page.waitForURL('**/admin/overview');
      assert.deepEqual(await page.evaluate(() => window.evidenceNavigation.entries().map(entry => entry.key)), originalKeys); assert.equal(await value(page).inputValue(), text); assert.equal(await recovery(page), null);
      await capture(page, '10-fragment-storage-block');
      await page.getByRole('button', { name: '取消', exact: true }).click(); await page.getByRole('heading', { name: '仪表盘', exact: true }).waitFor();
      await nav(page, '每周动态'); await ready(page); await open(page); assert.equal(await value(page).inputValue(), first.titleZh);
      await unchanged(); await capture(page, '10-fragment-resumed'); await page.close();
    });
    await check('storage-failure-blocks-switch-and-sidebar-leave-preserves-input', async () => {
      const page = await makePage(375); await visit(page); await open(page); await disableStorage(page); const text = '存储失败保留-' + runId; await edit(page, text);
      await page.getByRole('status').filter({ hasText: '浏览器未能保留当前周报的修改' }).waitFor(); await open(page, second); assert.equal(await value(page).inputValue(), text); await nav(page, '仪表盘'); assert.equal(new URL(page.url()).pathname, '/admin/weekly'); assert.equal(await value(page).inputValue(), text); assert.equal(await recovery(page), null); await unchanged(); await capture(page, '07-storage-block-mobile'); await page.close();
    });
    const pendingPage = async draft => {
      const page = await makePage(); await page.addInitScript(() => { window.evidenceNavigation = window.navigation; Object.defineProperty(window, 'navigation', { value: undefined, configurable: true }); });
      await visit(page, '/admin/overview'); await page.evaluate(() => { const legacy = { ...history.state }; delete legacy.__weeklyEditorHistoryPosition; History.prototype.replaceState.call(history, legacy, ''); });
      await nav(page, '每周动态'); await ready(page); await page.reload({ waitUntil: 'networkidle' }); await ready(page); await open(page, draft); await disableStorage(page);
      return page;
    };
    const saveResponse = async (page, draft) => {
      const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/admin/weekly/' + draft.id && r.request().method() === 'PATCH');
      await page.getByRole('button', { name: '保存草稿', exact: true }).click(); const result = await response; await result.finished(); return result;
    };
    const blockPending = async page => {
      page.dialogDecision = 'dismiss'; await page.goBack({ waitUntil: 'domcontentloaded', timeout: 1500 }).catch(() => null);
      await page.getByRole('status').filter({ hasText: '保存或取消编辑后，会继续返回' }).waitFor();
    };
    await check('boundary-pending-real-database-save-failure-retains-input-then-retry-resumes', async () => {
      const draft = await seed('待导航失败重试', start + 21 * 86400000), page = await pendingPage(draft);
      const text = '失败仍保留-' + runId; await edit(page, text); await blockPending(page);
      const trigger = 'weekly_failure_' + runId.replaceAll('-', '');
      await db.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON weekly_activity_drafts BEGIN SELECT RAISE(ABORT, 'isolated weekly failure'); END`);
      try {
        const failed = await saveResponse(page, draft); assert.equal(failed.status(), 400); await page.getByRole('alert').filter({ hasText: 'Invalid' }).waitFor();
        assert.equal(await value(page).inputValue(), text); assert.equal((await db.weeklyActivityDraft.findUniqueOrThrow({ where: { id: draft.id } })).titleZh, draft.titleZh);
        const next = text + '-继续输入'; await edit(page, next); assert.equal(new URL(page.url()).pathname, '/admin/overview');
        await capture(page, '14-pending-save-failed');
        await db.$executeRawUnsafe(`DROP TRIGGER ${trigger}`);
        assert.equal((await saveResponse(page, draft)).status(), 200); await page.getByRole('heading', { name: '仪表盘', exact: true }).waitFor();
        assert.equal((await db.weeklyActivityDraft.findUniqueOrThrow({ where: { id: draft.id } })).titleZh, next);
      } finally { await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trigger}`); }
      await unchanged(); await page.close();
    });
    await check('boundary-pending-real-409-retains-input-until-explicit-discard', async () => {
      const draft = await seed('待导航版本冲突', start + 28 * 86400000), loser = await pendingPage(draft), winner = await makePage();
      await visit(winner); await open(winner, draft); const winning = '待导航胜者-' + runId; await edit(winner, winning);
      const text = '冲突仍保留-' + runId; await edit(loser, text); await blockPending(loser);
      assert.equal((await saveResponse(winner, draft)).status(), 200); const failed = await saveResponse(loser, draft); assert.equal(failed.status(), 409);
      await loser.getByRole('alert').filter({ hasText: '周报草稿已在其他位置更新' }).waitFor(); assert.equal(await value(loser).inputValue(), text);
      await edit(loser, text + '-继续输入'); assert.equal(await recovery(loser, draft), null);
      await capture(loser, '15-pending-conflict-retained'); loser.dialogDecision = 'accept'; await loser.getByRole('button', { name: '取消', exact: true }).click();
      await loser.getByRole('heading', { name: '仪表盘', exact: true }).waitFor(); assert.equal((await db.weeklyActivityDraft.findUniqueOrThrow({ where: { id: draft.id } })).titleZh, winning);
      await unchanged(); await loser.close(); await winner.close();
    });
    await check('boundary-removeItem-failure-discard-does-not-resurrect-recovery', async () => {
      const page = await makePage(); await visit(page); await open(page); const text = '明确放弃副本-' + runId; await edit(page, text); assert.equal((await recovery(page)).values.titleZh, text);
      await page.evaluate(() => { Storage.prototype.removeItem = function () { throw new DOMException('Evidence remove disabled', 'SecurityError'); }; });
      await page.getByRole('button', { name: '取消', exact: true }).click(); await open(page);
      assert.equal(await value(page).inputValue(), first.titleZh, 'Explicitly discarded recovery must not reappear');
      await page.reload({ waitUntil: 'networkidle' }); await ready(page); await open(page); assert.equal(await value(page).inputValue(), first.titleZh);
      await unchanged(); await capture(page, '16-remove-discard-cleared'); await page.close();
    });
    await check('boundary-removeItem-failure-save-reopen-uses-current-version', async () => {
      const draft = await seed('删除副本保存版本', start + 35 * 86400000), page = await makePage(); await visit(page); await open(page, draft);
      const text = '已保存副本-' + runId; await edit(page, text); await page.evaluate(() => { Storage.prototype.removeItem = function () { throw new DOMException('Evidence remove disabled', 'SecurityError'); }; });
      assert.equal((await saveResponse(page, draft)).status(), 200); await value(page).waitFor({ state: 'hidden' });
      await open(page, { ...draft, titleZh: text }); await edit(page, text + '-再次保存');
      assert.equal((await saveResponse(page, draft)).status(), 200, 'Reopened saved draft must use the current server version');
      assert.equal((await db.weeklyActivityDraft.findUniqueOrThrow({ where: { id: draft.id } })).titleZh, text + '-再次保存');
      await unchanged(); await capture(page, '17-remove-save-current-version'); await page.close();
    });
    await check('boundary-remove-and-set-failure-keeps-discard-pending-until-storage-recovers', async () => {
      const page = await makePage(); await visit(page); await open(page); const text = '不能清理先保留-' + runId; await edit(page, text);
      await page.evaluate(() => { window.evidenceRemoveItem = Storage.prototype.removeItem; Storage.prototype.removeItem = function () { throw new DOMException('Evidence remove disabled', 'SecurityError'); }; }); await disableStorage(page);
      await page.getByRole('button', { name: '取消', exact: true }).click();
      assert.equal(await value(page).count(), 1, 'Failed cleanup must keep the editor open');
      assert.equal(await value(page).inputValue(), text, 'Failed recovery cleanup must not pretend to discard');
      await page.getByRole('status').filter({ hasText: '未能清除恢复副本' }).waitFor();
      await page.evaluate(() => { Storage.prototype.removeItem = window.evidenceRemoveItem; Storage.prototype.setItem = window.evidenceSetItem; });
      await page.getByRole('button', { name: '取消', exact: true }).click(); await page.reload({ waitUntil: 'networkidle' }); await ready(page); await open(page);
      assert.equal(await value(page).inputValue(), first.titleZh); await unchanged(); await capture(page, '18-cleanup-discard-retried'); await page.close();
    });
    await check('boundary-pending-save-success-cleanup-failure-keeps-editor-until-cleanup-retry', async () => {
      const draft = await seed('保存成功清理失败', start + 42 * 86400000), page = await pendingPage(draft);
      await page.evaluate(() => { Storage.prototype.setItem = window.evidenceSetItem; }); const text = '保存成功仍待清理-' + runId; await edit(page, text);
      await page.evaluate(() => { window.evidenceRemoveItem = Storage.prototype.removeItem; Storage.prototype.removeItem = function () { throw new DOMException('Evidence remove disabled', 'SecurityError'); }; }); await disableStorage(page); await blockPending(page);
      assert.equal((await saveResponse(page, draft)).status(), 200);
      assert.equal((await db.weeklyActivityDraft.findUniqueOrThrow({ where: { id: draft.id } })).titleZh, text);
      assert.equal(await value(page).count(), 1, 'Successful save with failed cleanup must keep the editor open');
      assert.equal(await value(page).inputValue(), text, 'Saved input must remain until obsolete recovery can be cleared');
      await page.getByRole('status').filter({ hasText: '已保存' }).filter({ hasText: '未能清除恢复副本' }).waitFor();
      const next = text + '-再次编辑'; await edit(page, next); assert.equal((await saveResponse(page, draft)).status(), 200);
      assert.equal(await value(page).inputValue(), next); await capture(page, '19-saved-cleanup-retained');
      await page.evaluate(() => { Storage.prototype.removeItem = window.evidenceRemoveItem; Storage.prototype.setItem = window.evidenceSetItem; });
      page.dialogDecision = 'accept';
      await page.getByRole('button', { name: '取消', exact: true }).click(); await page.getByRole('heading', { name: '仪表盘', exact: true }).waitFor();
      await nav(page, '每周动态'); await ready(page); await page.reload({ waitUntil: 'networkidle' }); await ready(page); await open(page, { ...draft, titleZh: next });
      assert.equal(await value(page).inputValue(), next); assert.equal(await recovery(page, draft), null); await unchanged(); await page.close();
    });
    for (const cancelFirst of [false, true]) await check('boundary-cleanup-failure-reverted-input-keeps-pending-navigation-cancel-' + cancelFirst, async () => {
      const draft = await seed('回退输入仍待清理-' + cancelFirst, start + (cancelFirst ? 56 : 49) * 86400000), page = await pendingPage(draft);
      await page.evaluate(() => { Storage.prototype.setItem = window.evidenceSetItem; }); const text = '待清理旧副本-' + runId; await edit(page, text);
      await page.evaluate(() => { window.evidenceRemoveItem = Storage.prototype.removeItem; Storage.prototype.removeItem = function () { throw new DOMException('Evidence remove disabled', 'SecurityError'); }; }); await disableStorage(page); await blockPending(page);
      if (cancelFirst) { page.dialogDecision = 'accept'; await page.getByRole('button', { name: '取消', exact: true }).click(); await page.getByRole('status').filter({ hasText: '未能清除恢复副本' }).waitFor(); }
      await value(page).fill(draft.titleZh);
      const state = await page.evaluate(() => ({ editorPresent: Boolean(document.querySelector('input[name="titleZh"]')), saveEnabled: [...document.querySelectorAll('button')].some(button => button.textContent === '保存草稿' && !button.disabled) }));
      results.observations.push({ case: currentCase, revertedEditor: state, actualUrl: page.url() });
      assert.equal(state.editorPresent, true, 'Reverting fields must not resume pending navigation before cleanup');
      assert.equal(state.saveEnabled, true, 'Cleanup retry must remain available even when fields match the server');
      assert.equal((await recovery(page, draft)).values.titleZh, text); assert.equal((await db.weeklyActivityDraft.findUniqueOrThrow({ where: { id: draft.id } })).titleZh, draft.titleZh);
      await capture(page, '20-cleanup-reverted-retained-' + cancelFirst);
      await page.evaluate(() => { Storage.prototype.removeItem = window.evidenceRemoveItem; Storage.prototype.setItem = window.evidenceSetItem; });
      page.dialogDecision = 'accept'; await page.getByRole('button', { name: '取消', exact: true }).click(); await page.getByRole('heading', { name: '仪表盘', exact: true }).waitFor();
      await nav(page, '每周动态'); await ready(page); await page.reload({ waitUntil: 'networkidle' }); await ready(page); await open(page, draft);
      assert.equal(await value(page).inputValue(), draft.titleZh); assert.equal(await recovery(page, draft), null); await unchanged(); await page.close();
    });
    await check('two-tabs-same-version-sequential-save-200-409-loser-recovery-retained', async () => {
      const winner = await makePage(), loser = await makePage(); await visit(winner); await visit(loser); await open(winner); await open(loser); const winnerText = '并行胜者-' + runId, loserText = '并行败者-' + runId; await edit(winner, winnerText); await edit(loser, loserText);
      const endpoint = '/api/admin/weekly/' + first.id;
      const save = async page => { const response = page.waitForResponse(r => new URL(r.url()).pathname === endpoint && r.request().method() === 'PATCH'); await page.getByRole('button', { name: '保存草稿', exact: true }).click(); const r = await response; await r.finished(); return { status: r.status(), body: await r.json(), request: r.request().postDataJSON() }; };
      const winning = await save(winner); assert.equal(winning.status, 200); await winner.getByRole('textbox', { name: '中文标题', exact: true }).waitFor({ state: 'hidden' }); const losing = await save(loser); assert.equal(losing.status, 409); await loser.getByRole('alert').filter({ hasText: '周报草稿已在其他位置更新' }).waitFor(); assert.equal(await value(loser).inputValue(), loserText); const retained = await recovery(loser); assert.equal(retained.values.titleZh, loserText); assert.equal(retained.expectedUpdatedAt, first.updatedAt.toISOString()); assert.equal(winning.request.expectedUpdatedAt, losing.request.expectedUpdatedAt); assert.equal((await db.weeklyActivityDraft.findUniqueOrThrow({ where: { id: first.id } })).titleZh, winnerText);
      results.observations.push({ case: currentCase, winning, losing, loserRecovery: retained }); await capture(loser, '08-conflict-loser-retained'); await loser.reload({ waitUntil: 'networkidle' }); await ready(loser); await open(loser, { ...first, titleZh: winnerText }); assert.equal(await value(loser).inputValue(), loserText); await loser.getByRole('status').filter({ hasText: '服务端版本已经变化' }).waitFor(); await capture(loser, '09-conflict-loser-reopen'); await winner.close(); await loser.close();
    });
    results.completed = true; results.passed = results.assertions.length === (process.env.HISTORY_ONLY === 'fragment' || process.env.HISTORY_ONLY === 'reverted' ? 2 : process.env.HISTORY_ONLY === 'legacy' ? 4 : process.env.HISTORY_ONLY === 'boundary' ? 8 : process.env.HISTORY_ONLY ? 5 : 27) && results.assertions.every(a => a.pass); process.exitCode = results.passed ? 0 : 1;
  } catch (e) { results.setupFailure = { stage: currentCase, message: e.message, stack: e.stack }; process.exitCode = 2; }
  finally {
    const cleanupErrors = [];
    try { if (context) await context.close(); } catch (e) { cleanupErrors.push('browser: ' + e.message); }
    try { if (db) await db.$disconnect(); } catch (e) { cleanupErrors.push('database: ' + e.message); }
    try { if (server && server.exitCode === null && server.signalCode === null) { const { owner } = await ownedTemp(); assert.equal(owner.serverPid, server.pid); assert.equal(owner.serverExecutable, process.execPath); const ended = new Promise(resolve => server.once('exit', resolve)); server.kill(); await ended; } } catch (e) { cleanupErrors.push('server: ' + e.message); }
    try { if (tempOwned) { const { target } = await ownedTemp(); await fs.rm(target, { recursive: true }); } } catch (e) { cleanupErrors.push('temp: ' + e.message); }
    results.cleanup = { browserClosed: !browser || !browser.isConnected(), databaseDisconnected: true, ownedServerExited: !server || server.exitCode !== null || server.signalCode !== null, port3019Free: await freePort(), ownedTempDeleted: await fs.stat(temp).then(() => false, () => true), errors: cleanupErrors };
    results.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(output, 'server.log'), serverLog.join('')); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n'); console.log(JSON.stringify({ output, assertions: results.assertions, setupFailure: results.setupFailure?.message, cleanup: results.cleanup }, null, 2));
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 2; });
