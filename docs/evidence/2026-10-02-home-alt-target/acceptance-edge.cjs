/* eslint-disable @typescript-eslint/no-require-imports -- Local browser evidence runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');

const repo = path.resolve(__dirname, '../../..');
const phase = process.env.HOME_ALT_PHASE || 'green';
const baseURL = 'http://127.0.0.1:3022';
const runtimeRequire = createRequire('C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const { chromium } = runtimeRequire('playwright');
const { PrismaClient } = createRequire(path.join(repo, 'package.json'))('@prisma/client');

(async () => {
  const scratch = path.join(repo, '.superpowers/home-alt-target');
  await fs.mkdir(scratch, { recursive: true });
  const databasePath = path.join(scratch, crypto.randomUUID() + '.db');
  await fs.copyFile('C:/Users/23399/AppData/Local/Temp/workstation-home-image-74cc5c8774f0499cbb1f13fc7f4e6c3f.db', databasePath);
  const databaseURL = 'file:' + databasePath.replaceAll('\\', '/');
  const db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
  const results = [], errors = [];
  let server, browser, errorMessage;
  const result = { phase, databasePath, results, errors, buildId: (await fs.readFile(path.join(repo, '.next/BUILD_ID'), 'utf8')).trim() };
  try {
    const user = await db.user.create({ data: { username: 'alt-target-' + crypto.randomUUID(), passwordHash: 'not-a-login-password', isActive: true } });
    const token = crypto.randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    server = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3022'], { cwd: repo, env: { ...process.env, DATABASE_URL: databaseURL }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
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
    const widths = phase === 'red' ? [1440] : phase === 'dirty-red' ? [] : [1440, 375];
    for (const width of widths) for (const kind of ['portrait', 'wechat']) for (const locale of ['zh', 'en']) {
      await page.setViewportSize({ width, height: 1100 });
      await page.goto(baseURL + '/admin/home', { waitUntil: 'domcontentloaded' });
      await page.getByRole('status').filter({ hasText: '预览已同步当前工作副本。' }).waitFor();
      const frame = page.frameLocator('iframe[title="真实首页预览"]');
      if (kind === 'wechat') await frame.locator('button[aria-describedby="wechat-qr"]').click();
      await frame.locator(`${kind === 'portrait' ? 'div' : 'img'}[data-cms-path="settings.${kind === 'wechat' ? 'wechatQrImage' : 'portraitImage'}"]`).click();
      if (width === 375) await page.getByRole('tab', { name: '选中项设置', exact: true }).click();
      const inspector = page.locator('[aria-label="选中项设置"]');
      await inspector.getByRole('link', { name: locale === 'zh' ? '中文' : 'English', exact: true }).click();
      await page.getByRole('heading', { name: '个人与首屏', exact: true }).or(page.getByRole('heading', { name: '联系与导航', exact: true })).waitFor();
      const id = `homepage-${locale}-${kind === 'wechat' ? 'footer-wechatAlt' : 'hero-portraitAlt'}`;
      const target = page.locator('#' + id);
      if (phase !== 'red') await page.waitForFunction((targetId) => {
        const input = document.getElementById(targetId), bounds = input?.getBoundingClientRect();
        return document.activeElement === input && bounds?.height > 0 && bounds.top >= 0 && bounds.bottom <= innerHeight;
      }, id);
      const state = await page.evaluate((targetId) => {
        const input = document.getElementById(targetId);
        const details = input?.closest('details');
        const bounds = input?.getBoundingClientRect();
        return { targetExists: !!input, task: document.getElementById('homepage-task-title')?.textContent,
          advancedOpen: !!details?.open, focused: document.activeElement === input,
          visible: !!bounds && bounds.width > 0 && bounds.height > 0 && bounds.top >= 0 && bounds.bottom <= innerHeight };
      }, id);
      const expectedTask = kind === 'wechat' ? '联系与导航' : '个人与首屏';
      const entry = { width, kind, locale, ...state, pass: state.targetExists && state.task === expectedTask && state.advancedOpen && state.focused && state.visible };
      if (entry.pass) {
        const copy = `ALT TARGET ${width} ${kind} ${locale}`;
        await target.fill(copy);
        await page.getByRole('button', { name: '保存草稿', exact: true }).click();
        await page.getByRole('status').filter({ hasText: '草稿已保存' }).waitFor();
        const response = await context.request.get(baseURL + '/api/admin/site/draft');
        const draft = await response.json();
        entry.saveStatus = response.status();
        entry.savedValue = kind === 'wechat' ? draft.content[locale].footer.wechatAlt : draft.content[locale].hero.portraitAlt;
        entry.pass = entry.saveStatus === 200 && entry.savedValue === copy;
      }
      results.push(entry);
      await page.screenshot({ path: path.join(__dirname, `${phase}-${width}-${kind}-${locale}.png`) });
    }

    if (phase !== 'red') for (const kind of ['portrait', 'wechat']) for (const locale of ['zh', 'en']) {
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.goto(baseURL + '/admin/home', { waitUntil: 'domcontentloaded' });
      await page.getByRole('status').filter({ hasText: '预览已同步当前工作副本。' }).waitFor();
      const frame = page.frameLocator('iframe[title="真实首页预览"]');
      const text = frame.locator('[data-cms-path="zh.hero.lineOne"]');
      await text.click();
      await page.locator('[aria-label="选中项设置"]').getByText('zh.hero.lineOne', { exact: true }).waitFor();
      const copy = `DIRTY ALT ${kind} ${locale}`;
      await text.fill(copy);
      if (kind === 'wechat') await frame.locator('button[aria-describedby="wechat-qr"]').click();
      await frame.locator(`${kind === 'portrait' ? 'div' : 'img'}[data-cms-path="settings.${kind === 'wechat' ? 'wechatQrImage' : 'portraitImage'}"]`).click();
      await page.waitForFunction(() => document.querySelector('[aria-labelledby="publish-readiness-title"]').textContent.includes('有未保存修改'));
      dialogs.length = 0;
      await page.locator('[aria-label="选中项设置"]').getByRole('link', { name: locale === 'zh' ? '中文' : 'English', exact: true }).click();
      const id = `homepage-${locale}-${kind === 'wechat' ? 'footer-wechatAlt' : 'hero-portraitAlt'}`;
      if (phase === 'green') await page.locator('#' + id).waitFor({ state: 'visible' });
      const targetState = await page.evaluate((targetId) => {
        const input = document.getElementById(targetId);
        return { targetExists: !!input, focused: document.activeElement === input, advancedOpen: !!input?.closest('details')?.open };
      }, id);
      const entry = { name: 'dirty-alt-shortcut', kind, locale, dialogs: [...dialogs], ...targetState };
      entry.pass = dialogs.length === 0 && targetState.targetExists && targetState.focused && targetState.advancedOpen;
      await page.getByRole('button', { name: '保存草稿', exact: true }).click();
      await page.getByRole('status').filter({ hasText: '草稿已保存' }).waitFor();
      const response = await context.request.get(baseURL + '/api/admin/site/draft');
      entry.savedText = (await response.json()).content.zh.hero.lineOne;
      entry.pass = entry.pass && response.status() === 200 && entry.savedText === copy;
      results.push(entry);
      await page.screenshot({ path: path.join(__dirname, `${phase}-dirty-${kind}-${locale}.png`) });
    }
    if (phase === 'green') {
      const target = page.locator('#homepage-en-footer-wechatAlt');
      await target.fill('DIRTY CROSS PAGE NAV');
      dialogs.length = 0;
      await page.getByRole('link', { name: '仪表盘', exact: true }).click();
      const entry = { name: 'cross-page-navigation-still-protected', dialogs: [...dialogs], pathname: new URL(page.url()).pathname, value: await target.inputValue() };
      entry.pass = entry.dialogs.includes('confirm') && entry.pathname === '/admin/home' && entry.value === 'DIRTY CROSS PAGE NAV';
      results.push(entry);
      await page.getByRole('button', { name: '保存草稿', exact: true }).click();
      await page.getByRole('status').filter({ hasText: '草稿已保存' }).waitFor();
    }
    assert.deepEqual(errors, []);
    assert.ok(results.every((entry) => entry.pass), 'Each image/language shortcut must open, expand and focus its target, then save');
  } catch (error) { errorMessage = error.message; process.exitCode = 1; }
  finally {
    if (browser) await browser.close();
    await db.$disconnect();
    if (server && server.exitCode === null && server.signalCode === null) { const exited = new Promise((resolve) => server.once('exit', resolve)); server.kill(); await exited; }
    result.errorMessage = errorMessage; result.pass = !errorMessage;
    result.cleanup = { browserClosed: !browser || !browser.isConnected(), databaseDisconnected: true, serverExited: !server || server.exitCode !== null || server.signalCode !== null, databaseDeleted: false };
    result.sourceHashes = await Promise.all(['src/components/admin/HomeWorkspace.tsx', 'src/components/admin/home/HomepageEditor.tsx', 'src/components/admin/home/HomepageVisualWorkspace.tsx'].map(async (file) => ({ path: file, sha256: crypto.createHash('sha256').update(await fs.readFile(path.join(repo, file))).digest('hex') })));
    await fs.writeFile(path.join(__dirname, phase + '-results.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ phase, pass: result.pass, results, errorMessage, cleanup: result.cleanup }));
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
