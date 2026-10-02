/* eslint-disable @typescript-eslint/no-require-imports -- Local browser evidence runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');

const repo = path.resolve(__dirname, '../../..');
const phase = process.env.HOME_UNLOAD_PHASE || 'green';
const baseURL = 'http://127.0.0.1:3021';
const sourceDB = 'C:/Users/23399/AppData/Local/Temp/workstation-home-image-74cc5c8774f0499cbb1f13fc7f4e6c3f.db';
const runtimeRequire = createRequire('C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const repoRequire = createRequire(path.join(repo, 'package.json'));
const { chromium } = runtimeRequire('playwright');
const { PrismaClient } = repoRequire('@prisma/client');

(async () => {
  const scratch = path.join(repo, '.superpowers/home-preview-unload');
  await fs.mkdir(scratch, { recursive: true });
  const databasePath = path.join(scratch, crypto.randomUUID() + '.db');
  await fs.copyFile(sourceDB, databasePath);
  const databaseURL = 'file:' + databasePath.replaceAll('\\', '/');
  const db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
  const results = [], errors = [];
  let server, browser, errorMessage;
  const result = { phase, databasePath, results, errors, buildId: (await fs.readFile(path.join(repo, '.next/BUILD_ID'), 'utf8')).trim() };
  try {
    const user = await db.user.create({ data: { username: 'preview-unload-' + crypto.randomUUID(), passwordHash: 'not-a-login-password', isActive: true } });
    const token = crypto.randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    server = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3021'], { cwd: repo, env: { ...process.env, DATABASE_URL: databaseURL }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 15000);
      server.on('error', reject);
      server.on('exit', (code) => reject(new Error('Server exited: ' + code)));
      server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Ready')) { clearTimeout(timeout); resolve(); } });
    });
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    result.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addCookies([{ name: 'workstation_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    const dialogs = [];
    page.on('dialog', async (dialog) => { dialogs.push(dialog.type()); await dialog.dismiss(); });
    const field = page.frameLocator('iframe[title="真实首页预览"]').locator('[data-cms-path="zh.hero.lineOne"]');
    async function open() {
      await page.goto(baseURL + '/admin/home', { waitUntil: 'domcontentloaded' });
      await page.getByRole('status').filter({ hasText: '预览已同步当前工作副本。' }).waitFor();
      await field.click();
      await page.locator('[aria-label="选中项设置"]').getByText('zh.hero.lineOne', { exact: true }).waitFor();
    }
    async function reload() {
      const before = dialogs.length;
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch((error) => {
        const cancelled = dialogs.slice(before).includes('beforeunload');
        if (!cancelled || (!error.message.includes('ERR_ABORTED') && !error.message.includes('Timeout'))) throw error;
      });
      await field.waitFor();
    }
    await open();
    const value = 'UNCOMMITTED FOCUSED TEXT';
    await field.fill(value);
    const parentClean = !(await page.locator('[aria-labelledby="publish-readiness-title"]').innerText()).includes('有未保存修改');
    const focused = await field.evaluate((node) => node.ownerDocument.activeElement === node);
    await page.screenshot({ path: path.join(__dirname, phase + '-focused-before-reload.png') });
    await reload();
    const first = { name: 'focused-native-reload-cancel', parentClean, focused, dialogs: [...dialogs], after: await field.textContent(), expected: value };
    first.pass = parentClean && focused && first.dialogs.includes('beforeunload') && first.after === value;
    results.push(first);
    await page.screenshot({ path: path.join(__dirname, phase + '-after-reload.png') });
    assert.equal(first.pass, true, 'Focused uncommitted text must trigger native unload confirmation and survive Cancel');

    if (phase !== 'red') {
      await page.getByRole('button', { name: '保存草稿', exact: true }).click();
      await page.getByRole('status').filter({ hasText: '草稿已保存' }).waitFor();
      dialogs.length = 0;
      await reload();
      const saved = { name: 'saved-native-reload', dialogs: [...dialogs], after: await field.textContent() };
      saved.pass = saved.dialogs.length === 0 && saved.after === value;
      results.push(saved); assert.equal(saved.pass, true);

      await field.click();
      await field.dispatchEvent('compositionstart', { data: '模拟' });
      dialogs.length = 0;
      await reload();
      const composing = { name: 'composition-native-reload-cancel', dialogs: [...dialogs], simulation: 'Synthetic composition event, not system IME' };
      composing.pass = composing.dialogs.includes('beforeunload');
      results.push(composing); assert.equal(composing.pass, true);
      await field.dispatchEvent('compositionend', { data: '模拟' });
      await page.getByRole('button', { name: '保存草稿', exact: true }).click();
      await page.getByRole('status').filter({ hasText: '草稿已保存' }).waitFor();
      dialogs.length = 0;
      await field.click();
      await reload();
      const clean = { name: 'clean-focus-native-reload', dialogs: [...dialogs] };
      clean.pass = clean.dialogs.length === 0; results.push(clean); assert.equal(clean.pass, true);

      await field.click();
      await field.fill('UNCOMMITTED BEFORE CLOSE');
      dialogs.length = 0;
      await Promise.all([page.waitForEvent('dialog'), page.close({ runBeforeUnload: true })]);
      const close = { name: 'focused-native-close-cancel', dialogs: [...dialogs], closed: page.isClosed(), after: await field.textContent() };
      close.pass = close.dialogs.includes('beforeunload') && !close.closed && close.after === 'UNCOMMITTED BEFORE CLOSE';
      results.push(close); assert.equal(close.pass, true);
    }
    assert.deepEqual(errors, []);
  } catch (error) { errorMessage = error.message; process.exitCode = 1; }
  finally {
    if (browser) await browser.close();
    await db.$disconnect();
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill(); await exited;
    }
    result.errorMessage = errorMessage;
    result.pass = !errorMessage;
    result.cleanup = { browserClosed: !browser || !browser.isConnected(), databaseDisconnected: true, serverExited: !server || server.exitCode !== null || server.signalCode !== null, databaseDeleted: false };
    result.sourceHash = crypto.createHash('sha256').update(await fs.readFile(path.join(repo, 'src/components/public/HomeVisualEditor.tsx'))).digest('hex');
    await fs.writeFile(path.join(__dirname, phase + '-results.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ phase, pass: result.pass, results, errorMessage, cleanup: result.cleanup }));
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
