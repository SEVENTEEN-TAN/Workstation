/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node CJS evidence runner. */
/* Local-only red regression: an older refresh must not overwrite a completed save. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');

const OLD = 'ORDER OLD X';
const SAVED = 'ORDER SAVED A';
const baseURL = 'http://127.0.0.1:3012';

async function runRace({ page, context, db, evidenceDir, head }) {
  const timeline = [];
  const record = (event, details = {}) => timeline.push({ sequence: timeline.length + 1, event, ...details });
  const initial = await context.request.get(baseURL + '/api/admin/site/draft');
  assert.equal(initial.status(), 200);
  const draft = await initial.json();
  draft.content.zh.hero.lineOne = OLD;
  await db.siteVersion.update({ where: { id: draft.id }, data: { content: draft.content } });
  await page.goto(baseURL + '/admin/home', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: '字段编辑', exact: true }).click();
  const field = page.locator('#homepage-zh-hero-lineOne');
  await field.waitFor();
  await page.setViewportSize({ width: 1440, height: 1440 });
  const snapshot = async (name) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const state = await page.evaluate(() => {
      const readiness = document.querySelector('[aria-labelledby="publish-readiness-title"]');
      const entries = [...readiness.querySelectorAll('dl > div')];
      const buttons = [...document.querySelectorAll('button')];
      return {
        title: document.querySelector('#homepage-zh-hero-lineOne').value,
        dirtyLabel: entries.find((item) => item.querySelector('dt').textContent === '状态').querySelector('dd').textContent,
        saveDisabled: buttons.find((item) => item.textContent === '保存草稿')?.disabled,
        publishDisabled: buttons.find((item) => item.textContent === '发布')?.disabled,
        refreshText: buttons.find((item) => ['刷新', '刷新中'].includes(item.textContent))?.textContent,
      };
    });
    await page.screenshot({ path: path.join(evidenceDir, name + '.png') });
    record(name, state);
    return state;
  };
  const baseline = await snapshot('01-old-x-baseline');
  assert.equal(baseline.title, OLD);
  await field.fill(SAVED);
  await page.waitForFunction(() => document.querySelector('[aria-labelledby="publish-readiness-title"]').textContent.includes('有未保存修改'));
  const edited = await snapshot('02-local-a-unsaved');
  assert.equal(edited.title, SAVED);

  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const held = new Set();
  const draftResponses = [];
  let savePut = null;
  const routeHandler = async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname;
    const method = request.method();
    if (method === 'GET' && !held.has(endpoint)) {
      held.add(endpoint);
      const response = await route.fetch();
      const data = await response.json();
      record('old-refresh-response-captured', {
        endpoint, status: response.status(),
        ...(endpoint.endsWith('/draft') ? { title: data.content.zh.hero.lineOne } : { count: data.length }),
      });
      assert.equal(response.status(), 200);
      if (endpoint.endsWith('/draft')) assert.equal(data.content.zh.hero.lineOne, OLD);
      await gate;
      record('old-refresh-response-released', { endpoint });
      await route.fulfill({ response });
      return;
    }
    const response = await route.fetch();
    const data = await response.json();
    if (endpoint.endsWith('/draft')) {
      const details = { method, status: response.status(), title: data.content?.zh.hero.lineOne };
      record('save-operation-api-response', details);
      if (method === 'PUT') savePut = details;
      else draftResponses.push(details);
    }
    await route.fulfill({ response });
  };
  await page.route(/\/api\/admin\/site\/(draft|versions)$/, routeHandler);
  const dialogs = [];
  const acceptDialog = async (dialog) => {
    dialogs.push(dialog.message());
    record('refresh-confirm-accepted', { message: dialog.message() });
    await dialog.accept();
  };
  page.on('dialog', acceptDialog);
  try {
    await page.getByRole('button', { name: '刷新', exact: true }).click();
    const deadline = Date.now() + 10000;
    while (timeline.filter((item) => item.event === 'old-refresh-response-captured').length < 2) {
      if (Date.now() > deadline) throw new Error('Refresh responses were not captured before save');
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(dialogs.length, 1);
    assert.equal(await page.getByRole('button', { name: '保存草稿', exact: true }).isEnabled(), true);
    await snapshot('03-refresh-held-save-enabled');
    await page.getByRole('button', { name: '保存草稿', exact: true }).click();
    await page.getByRole('status').filter({ hasText: '草稿已保存' }).waitFor();
    const afterSave = await snapshot('04-save-a-completed');
    assert.deepEqual(savePut, { method: 'PUT', status: 200, title: SAVED });
    assert.equal(draftResponses.at(-1)?.title, SAVED);
    assert.equal(afterSave.title, SAVED);
    assert.equal(afterSave.dirtyLabel, '已保存');
    assert.equal(afterSave.refreshText, '刷新中');
    release();
    await page.getByRole('button', { name: '刷新', exact: true }).waitFor();
    await page.getByRole('status').filter({ hasText: '主页内容已更新' }).waitFor();
    const afterOldRefresh = await snapshot('05-stale-refresh-overwrites-a');
    const finalAPI = await context.request.get(baseURL + '/api/admin/site/draft');
    assert.equal(finalAPI.status(), 200);
    const finalDraft = await finalAPI.json();
    const finalDB = await db.siteVersion.findUniqueOrThrow({ where: { id: draft.id } });
    const databaseTitle = finalDB.content.zh.hero.lineOne;
    record('fresh-api-and-database-after-stale-response', { apiStatus: finalAPI.status(), apiTitle: finalDraft.content.zh.hero.lineOne, databaseTitle });
    assert.equal(databaseTitle, SAVED);
    assert.equal(finalDraft.content.zh.hero.lineOne, SAVED);
    const result = {
      head, browser: page.context().browser().version(), baseURL,
      delayedResponses: 'Actual GET responses were read from the server before PUT, then held at the browser route boundary.',
      field: 'zh.hero.lineOne', oldTitle: OLD, savedTitle: SAVED,
      baseline, edited, afterSave, afterOldRefresh, databaseTitle,
      expectations: { workingCopy: SAVED, savedBaselineDirtyLabel: '已保存', freshAPI: SAVED },
      inference: 'Working copy returned to X and the UI still says saved; together these show savedContent also returned to X. Internal React state was not read directly.',
      pass: afterOldRefresh.title === SAVED,
      timeline,
    };
    await fs.writeFile(path.join(evidenceDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    assert.equal(afterOldRefresh.title, SAVED, 'RED: a completed save must survive an older refresh response');
    return result;
  } finally {
    release();
    page.off('dialog', acceptDialog);
    await page.unroute(/\/api\/admin\/site\/(draft|versions)$/, routeHandler);
  }
}

module.exports = { runRace };

if (require.main === module) {
  (async () => {
    const repo = path.resolve(__dirname, '../../..');
    const runtimeModules = process.env.CODEY_RUNTIME_MODULES || 'C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
    const sourceDB = process.env.CODEY_SOURCE_DB || 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db';
    const requireRuntime = createRequire(path.join(runtimeModules, 'package.json'));
    const requireRepo = createRequire(path.join(repo, 'package.json'));
    const { chromium } = requireRuntime('playwright');
    const { PrismaClient } = requireRepo('@prisma/client');
    const databasePath = path.join(os.tmpdir(), 'workstation-home-order-' + crypto.randomUUID() + '.db');
    await fs.copyFile(sourceDB, databasePath);
    const databaseURL = 'file:' + databasePath.replaceAll('\\', '/');
    const db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
    let browser;
    let server;
    try {
      const user = await db.user.create({ data: { username: 'home-order-' + crypto.randomUUID(), passwordHash: 'not-a-login-password', isActive: true } });
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
      const head = require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
      await runRace({ page, context, db, evidenceDir: __dirname, head });
      console.log('PASS: completed save survived older refresh');
    } finally {
      if (browser) await browser.close();
      await db.$disconnect();
      if (server && server.exitCode === null) {
        const exited = new Promise((resolve) => server.once('exit', resolve));
        server.kill();
        await exited;
      }
      for (const suffix of ['', '-wal', '-shm']) await fs.rm(databasePath + suffix, { force: true });
      let portClosed = false;
      try { await fetch(baseURL, { signal: AbortSignal.timeout(1000) }); } catch { portClosed = true; }
      await fs.writeFile(path.join(__dirname, 'cleanup.json'), JSON.stringify({ browserClosed: !browser || !browser.isConnected(), databaseDisconnected: true, ownedServerExited: !server || server.exitCode !== null || server.signalCode !== null, port3012Closed: portClosed, temporaryDatabaseDeleted: true }, null, 2) + '\n');
    }
  })().catch(async (error) => {
    await fs.writeFile(path.join(__dirname, 'regression-error.txt'), error.message + '\n');
    console.error(error.message);
    process.exitCode = 1;
  });
}
