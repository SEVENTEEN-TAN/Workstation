/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CJS evidence runner. */
/* Local-only repaired-build acceptance. Red evidence files are never overwritten. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');

const baseURL = 'http://127.0.0.1:3012';
const sitePattern = /\/api\/admin\/site\/(draft|versions|publish|rollback)$/;
const results = [];
const pageErrors = [];
const timeline = [];
const record = (event, details = {}) => timeline.push({ sequence: timeline.length + 1, event, ...details });
const defer = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

async function runChecks({ page, context, db, evidenceDir }) {
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('dialog', async (dialog) => { record('browser-dialog-accepted', { type: dialog.type(), message: dialog.message() }); await dialog.accept(); });
  const field = page.locator('#homepage-zh-hero-lineOne');
  const button = (name) => page.getByRole('button', { name, exact: true });
  const success = (text) => page.getByRole('status').filter({ hasText: text }).waitFor();
  const waitUnlocked = () => page.waitForFunction(() => [...document.querySelectorAll('button')].some((item) => item.textContent === '刷新' && !item.disabled));
  const dirty = async (expected) => assert.equal(await page.locator('[aria-labelledby="publish-readiness-title"] dl').innerText().then((text) => text.includes('有未保存修改')), expected);
  const snapshot = async (name) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const state = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('button')];
      const find = (labels) => { const node = buttons.find((item) => labels.includes(item.textContent)); return node ? { text: node.textContent, disabled: node.disabled } : null; };
      return { title: document.querySelector('#homepage-zh-hero-lineOne')?.value ?? null,
        readiness: document.querySelector('[aria-labelledby="publish-readiness-title"] dl')?.innerText,
        refresh: find(['刷新', '刷新中']), save: find(['保存草稿', '保存中']), publish: find(['发布', '发布中']),
        rollback: buttons.filter((item) => ['恢复为草稿', '恢复中'].includes(item.textContent)).map((item) => ({ text: item.textContent, disabled: item.disabled })),
        dialogOpen: Boolean(document.querySelector('dialog[open]')) };
    });
    await page.screenshot({ path: path.join(evidenceDir, 'green-' + name + '.png') });
    record(name, state);
    return state;
  };
  const assertLocked = async (name, withHistory = true) => {
    const state = await snapshot(name);
    for (const action of ['refresh', 'save', 'publish']) assert.equal(state[action]?.disabled, true, name + ': ' + action + ' must be disabled');
    if (withHistory) {
      await page.getByRole('tab', { name: '发布记录', exact: true }).click();
      const history = await snapshot(name + '-history');
      assert.ok(history.rollback.length >= 2, 'History must have a rollback candidate');
      assert.ok(history.rollback.every((item) => item.disabled), 'All rollback controls must be disabled');
      await page.getByRole('tab', { name: '字段编辑', exact: true }).click();
      await field.waitFor();
    }
    return state;
  };
  const verifyPersisted = async (title) => {
    const response = await context.request.get(baseURL + '/api/admin/site/draft');
    assert.equal(response.status(), 200);
    const draft = await response.json();
    const stored = await db.siteVersion.findUniqueOrThrow({ where: { id: draft.id } });
    assert.equal(draft.content.zh.hero.lineOne, title);
    assert.equal(stored.content.zh.hero.lineOne, title);
    record('fresh-api-db-agree', { apiStatus: response.status(), apiTitle: draft.content.zh.hero.lineOne, databaseTitle: stored.content.zh.hero.lineOne });
    return draft;
  };
  const reset = async (title) => {
    const response = await context.request.get(baseURL + '/api/admin/site/draft');
    assert.equal(response.status(), 200);
    const draft = await response.json();
    draft.content.zh.hero.lineOne = title;
    await db.siteVersion.update({ where: { id: draft.id }, data: { content: draft.content } });
    await page.goto(baseURL + '/admin/home', { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: '字段编辑', exact: true }).click();
    await field.waitFor();
    assert.equal(await field.inputValue(), title);
    await waitUnlocked();
    return draft;
  };
  const heldResponses = async (matches) => {
    const gate = defer();
    const captured = defer();
    const captures = [];
    const handler = async (route) => {
      const request = route.request();
      const endpoint = new URL(request.url()).pathname;
      const key = request.method() + ' ' + endpoint;
      const response = await route.fetch();
      if (matches.includes(key) && !captures.some((item) => item.key === key)) {
        const data = await response.json();
        captures.push({ key, status: response.status(), title: data.content?.zh.hero.lineOne, count: Array.isArray(data) ? data.length : undefined });
        record('actual-response-held', captures.at(-1));
        if (captures.length === matches.length) captured.resolve();
        await gate.promise;
        record('actual-response-released', { key });
      }
      await route.fulfill({ response });
    };
    await page.route(sitePattern, handler);
    return { captures,
      wait: () => Promise.race([captured.promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Expected responses not captured: ' + matches)), 10000))]),
      release: () => gate.resolve(),
      close: async () => { gate.resolve(); await page.unroute(sitePattern, handler); } };
  };
  const scenario = async (name, check) => {
    const start = timeline.length;
    record('scenario-start', { name });
    try { await check(); results.push({ name, pass: true, firstEvent: start + 1, lastEvent: timeline.length }); console.log('PASS: ' + name); }
    catch (error) { results.push({ name, pass: false, error: error.message, firstEvent: start + 1, lastEvent: timeline.length }); throw error; }
  };

  await scenario('refresh-held-mutex-edit-b-and-save', async () => {
    await reset('GREEN REFRESH X');
    await snapshot('01-baseline');
    await field.fill('GREEN REFRESH A');
    const held = await heldResponses(['GET /api/admin/site/draft', 'GET /api/admin/site/versions']);
    try {
      await button('刷新').click(); await held.wait();
      assert.equal(held.captures.find((item) => item.key.endsWith('/draft')).title, 'GREEN REFRESH X');
      await assertLocked('02-refresh-held');
      await field.fill('GREEN REFRESH B');
      assert.equal(await field.inputValue(), 'GREEN REFRESH B');
      held.release(); await success('主页内容已更新'); await waitUnlocked();
      assert.equal(await field.inputValue(), 'GREEN REFRESH B'); await dirty(true);
      await snapshot('03-refresh-released-b-preserved');
    } finally { await held.close(); }
    await button('保存草稿').click(); await success('草稿已保存'); await waitUnlocked();
    await verifyPersisted('GREEN REFRESH B'); await dirty(false); await snapshot('04-refresh-b-saved');
  });

  await scenario('save-readback-held-mutex-new-edit-preserved', async () => {
    await reset('GREEN SAVE X'); await field.fill('GREEN SAVE A');
    const held = await heldResponses(['GET /api/admin/site/draft', 'GET /api/admin/site/versions']);
    try {
      await button('保存草稿').click(); await held.wait();
      assert.equal(held.captures.find((item) => item.key.endsWith('/draft')).title, 'GREEN SAVE A');
      await assertLocked('05-save-readback-held');
      await field.fill('GREEN SAVE B'); held.release();
      await success('草稿已保存'); await waitUnlocked();
      assert.equal(await field.inputValue(), 'GREEN SAVE B'); await dirty(true); await verifyPersisted('GREEN SAVE A');
      await snapshot('06-save-b-preserved');
    } finally { await held.close(); }
    await button('保存草稿').click(); await success('草稿已保存'); await waitUnlocked(); await verifyPersisted('GREEN SAVE B');
  });

  await scenario('publish-readback-held-mutex-new-edit-preserved', async () => {
    await reset('GREEN PUBLISH A');
    const held = await heldResponses(['GET /api/admin/site/draft', 'GET /api/admin/site/versions']);
    try {
      await button('发布').click(); await held.wait();
      await assertLocked('07-publish-readback-held');
      await field.fill('GREEN PUBLISH B'); held.release();
      await success('主页已发布'); await waitUnlocked();
      assert.equal(await field.inputValue(), 'GREEN PUBLISH B'); await dirty(true); await verifyPersisted('GREEN PUBLISH A');
      const published = await db.siteVersion.findFirstOrThrow({ where: { status: 'PUBLISHED' }, orderBy: { publishedAt: 'desc' } });
      assert.equal(published.content.zh.hero.lineOne, 'GREEN PUBLISH A');
      record('published-db-title', { title: published.content.zh.hero.lineOne });
      await snapshot('08-publish-b-preserved');
    } finally { await held.close(); }
    await button('保存草稿').click(); await success('草稿已保存'); await waitUnlocked(); await verifyPersisted('GREEN PUBLISH B');
  });

  await scenario('rollback-post-and-versions-held-mutex-modal-limit', async () => {
    await reset('GREEN ROLLBACK X');
    await page.getByRole('tab', { name: '发布记录', exact: true }).click();
    const restore = page.locator('button:not([disabled])').filter({ hasText: /^恢复为草稿$/ });
    await restore.first().click();
    const dialog = page.getByRole('dialog', { name: '确认恢复主页版本为草稿' });
    await dialog.waitFor();
    const post = await heldResponses(['POST /api/admin/site/rollback']);
    let versions;
    try {
      await dialog.getByRole('button', { name: '恢复为草稿', exact: true }).click(); await post.wait();
      const duringPost = await assertLocked('09-rollback-post-held', false);
      assert.equal(duringPost.dialogOpen, true);
      assert.ok(duringPost.rollback.every((item) => item.disabled));
      assert.equal(await dialog.getByRole('button', { name: '取消', exact: true }).isDisabled(), true);
      await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(), true);
      versions = await heldResponses(['GET /api/admin/site/versions']);
      post.release(); await versions.wait();
      const duringVersions = await assertLocked('10-rollback-versions-held', false);
      assert.equal(duringVersions.dialogOpen, true);
      assert.ok(duringVersions.rollback.every((item) => item.disabled));
      record('rollback-editing-limit', { nativeModalMatches: await dialog.evaluate((node) => node.matches(':modal')), attemptedBackgroundEdit: false, reason: 'Native modal remains open across POST and versions readback; underlying field editing is not an actual user path.' });
      versions.release(); await success('已恢复为草稿，请预览后发布'); await waitUnlocked();
      assert.equal(await dialog.isVisible(), false);
      await page.getByRole('tab', { name: '字段编辑', exact: true }).click();
      assert.equal(await field.inputValue(), post.captures[0].title);
      await verifyPersisted(post.captures[0].title); await dirty(false); await snapshot('11-rollback-completed');
    } finally { if (versions) await versions.close(); await post.close(); }
  });

  for (const mode of ['refresh', 'save']) await scenario(mode + '-500-unlocks-and-retries', async () => {
    await reset('GREEN FAILURE ' + mode);
    if (mode === 'save') await field.fill('GREEN RETRY SAVE');
    let failed = false;
    const handler = async (route) => {
      if (!failed && route.request().method() === (mode === 'save' ? 'PUT' : 'GET')) {
        failed = true;
        record('simulated-http-500', { mode });
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Local acceptance simulated 500' }) });
      } else await route.continue();
    };
    await page.route('**/api/admin/site/draft', handler);
    try {
      await button(mode === 'save' ? '保存草稿' : '刷新').click();
      await page.getByRole('alert').filter({ hasText: 'Local acceptance simulated 500' }).waitFor(); await waitUnlocked(); assert.equal(failed, true);
      assert.equal(await button(mode === 'save' ? '保存草稿' : '发布').isEnabled(), true);
      await page.getByRole('tab', { name: '发布记录', exact: true }).click();
      assert.ok(await button('恢复为草稿').evaluateAll((nodes) => nodes.some((node) => !node.disabled)));
      await page.getByRole('tab', { name: '字段编辑', exact: true }).click();
      await snapshot('12-' + mode + '-500-unlocked');
    } finally { await page.unroute('**/api/admin/site/draft', handler); }
    await button(mode === 'save' ? '保存草稿' : '刷新').click();
    await success(mode === 'save' ? '草稿已保存' : '主页内容已更新'); await waitUnlocked();
    await verifyPersisted(mode === 'save' ? 'GREEN RETRY SAVE' : 'GREEN FAILURE refresh');
  });

  await scenario('visual-flush-waits-with-mutex-before-http', async () => {
    await reset('GREEN FLUSH');
    await page.getByRole('tab', { name: '可视化编辑', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '预览已同步当前工作副本。' }).waitFor();
    const visualField = page.frameLocator('iframe[title="真实首页预览"]').locator('[data-cms-path="zh.hero.lineOne"]');
    await visualField.waitFor();
    await visualField.dispatchEvent('compositionstart', { data: '模拟' });
    const requests = [];
    const watcher = (request) => { if (sitePattern.test(request.url())) requests.push({ method: request.method(), endpoint: new URL(request.url()).pathname }); };
    page.on('request', watcher);
    try {
      await button('保存草稿').click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some((node) => node.textContent === '保存中' && node.disabled));
      const state = await assertLocked('13-visual-flush-held', false);
      assert.equal(state.save.text, '保存中'); assert.deepEqual(requests, []);
      record('flush-before-http', { simulation: 'Synthetic compositionstart delays actual iframe flush acknowledgement; not a real system IME check.', requestsBeforeAcknowledgement: requests });
      await visualField.dispatchEvent('compositionend', { data: '模拟' });
      await success('草稿已保存'); await waitUnlocked();
      assert.ok(requests.some((request) => request.method === 'PUT'));
      await verifyPersisted('GREEN FLUSH'); await snapshot('14-visual-flush-completed');
    } finally { page.off('request', watcher); }
  });
  assert.deepEqual(pageErrors, [], 'No page script errors');
}

(async () => {
  const repo = path.resolve(__dirname, '../../..');
  const runtimeModules = process.env.CODEY_RUNTIME_MODULES || 'C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
  const sourceDB = process.env.CODEY_SOURCE_DB || 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db';
  const requireRuntime = createRequire(path.join(runtimeModules, 'package.json'));
  const requireRepo = createRequire(path.join(repo, 'package.json'));
  const { chromium } = requireRuntime('playwright');
  const { PrismaClient } = requireRepo('@prisma/client');
  const databasePath = path.join(os.tmpdir(), 'workstation-home-order-green-' + crypto.randomUUID() + '.db');
  await fs.copyFile(sourceDB, databasePath);
  const databaseURL = 'file:' + databasePath.replaceAll('\\', '/');
  const db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
  let browser; let server; let errorMessage;
  const startedAt = new Date().toISOString();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
  const homeSourceHash = crypto.createHash('sha256').update(await fs.readFile(path.join(repo, 'src/components/admin/HomeWorkspace.tsx'))).digest('hex');
  try {
    const user = await db.user.create({ data: { username: 'home-order-green-' + crypto.randomUUID(), passwordHash: 'not-a-login-password', isActive: true } });
    const token = crypto.randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    server = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3012'], { cwd: repo, env: { ...process.env, DATABASE_URL: databaseURL }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Local test server startup timeout')), 15000);
      server.on('error', (error) => { clearTimeout(timeout); reject(error); });
      server.on('exit', (code) => { clearTimeout(timeout); reject(new Error('Local test server exited: ' + code)); });
      server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Ready')) { clearTimeout(timeout); resolve(); } });
    });
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } });
    await context.addCookies([{ name: 'workstation_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    await runChecks({ page, context, db, evidenceDir: __dirname });
  } catch (error) { errorMessage = error.message; console.error(error.message); process.exitCode = 1; }
  finally {
    const browserVersion = browser?.version();
    if (browser) await browser.close();
    await db.$disconnect();
    if (server && server.exitCode === null) { const exited = new Promise((resolve) => server.once('exit', resolve)); server.kill(); await exited; }
    for (const suffix of ['', '-wal', '-shm']) await fs.rm(databasePath + suffix, { force: true });
    let portClosed = false;
    try { await fetch(baseURL, { signal: AbortSignal.timeout(1000) }); } catch { portClosed = true; }
    const cleanup = { browserClosed: !browser || !browser.isConnected(), databaseDisconnected: true, ownedServerExited: !server || server.exitCode !== null || server.signalCode !== null, port3012Closed: portClosed, temporaryDatabaseDeleted: true };
    await fs.writeFile(path.join(__dirname, 'green-cleanup.json'), JSON.stringify(cleanup, null, 2) + '\n');
    await fs.writeFile(path.join(__dirname, 'green-results.json'), JSON.stringify({ startedAt, completedAt: new Date().toISOString(), head, homeSourceHash, browser: browserVersion, baseURL, build: 'Existing repaired production .next build provided by root; runner did not rebuild.', scenarioCount: results.length, passCount: results.filter((item) => item.pass).length, pass: !errorMessage && results.length === 7, errorMessage, pageErrors, results, timeline, cleanup, limits: ['Local Windows Edge and copied SQLite only; no production/merge/deployment.', 'Rollback native modal blocks background editing; recovery during continued new input is not proven.', 'Synthetic composition events test flush sequencing, not a real Windows Chinese IME.'] }, null, 2) + '\n');
    console.log('Scenarios ' + results.filter((item) => item.pass).length + '/' + results.length + ' passed; cleanup=' + JSON.stringify(cleanup));
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
