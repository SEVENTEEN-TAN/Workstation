/* eslint-disable @typescript-eslint/no-require-imports -- Standalone local evidence runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const runId = crypto.randomUUID(), prefix = 'workstation-public-interaction-';
const temp = path.join(os.tmpdir(), prefix + runId), output = path.join(__dirname, 'run-' + runId);
const port = 3016, base = 'http://127.0.0.1:' + port;
const results = { runId, startedAt: new Date().toISOString(), assertions: [], pages: [], pageErrors: [], failedRequests: [], cleanup: {} };
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.once('error', () => resolve(false)); s.listen(port, '127.0.0.1', () => s.close(() => resolve(true))); });
let server, browser, db;
async function check(name, work) { try { await work(); results.assertions.push({ name, pass: true }); } catch (e) { results.assertions.push({ name, pass: false, error: e.message, classification: e.code === 'ERR_ASSERTION' ? 'business-assertion' : 'fixture-or-wait' }); } }
async function capture(page, name, locator) {
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: false });
  if (locator) await locator.screenshot({ path: path.join(output, name + '-target.png') });
}
async function main() {
  await fs.mkdir(output, { recursive: true }); assert.equal(await freePort(), true, 'Port occupied; no unowned process is stopped');
  await fs.mkdir(temp); await fs.writeFile(path.join(temp, 'owner.json'), JSON.stringify({ runId, purpose: 'public-interaction' }));
  await fs.copyFile(process.env.SOURCE_DB || 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db', path.join(temp, 'test.db'));
  const requireRepo = createRequire(path.join(root, 'package.json'));
  const requireRuntime = createRequire('C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
  const { PrismaClient } = requireRepo('@prisma/client'), { chromium } = requireRuntime('playwright');
  const databaseURL = 'file:' + path.join(temp, 'test.db').replaceAll('\\', '/');
  db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
  try {
    const published = await db.siteVersion.findFirstOrThrow({ where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' } });
    results.fixtureVersion = published.version;
    const content = published.content;
    results.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
    results.buildId = (await fs.readFile(path.join(root, '.next/BUILD_ID'), 'utf8')).trim();
    results.sourceHashes = {};
    for (const file of ['src/components/public/Navbar.tsx', 'src/components/public/Footer.tsx', 'src/components/public/HomeExperience.tsx', 'src/components/public/i18n.tsx', 'src/app/globals.css', 'src/app/page.tsx']) results.sourceHashes[file] = crypto.createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex');
    server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: root, env: { ...process.env, DATABASE_URL: databaseURL }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server-startup-timeout')), 15000); server.once('error', (e) => { clearTimeout(timer); reject(e); }); server.once('exit', (code) => { clearTimeout(timer); reject(new Error('server-exited-' + code)); }); server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Ready')) { clearTimeout(timer); resolve(); } }); });
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    results.browser = browser.version();
    for (const locale of ['zh', 'en']) {
      const context = await browser.newContext({ viewport: { width: 375, height: 900 }, hasTouch: true, locale: locale === 'zh' ? 'zh-CN' : 'en-US', reducedMotion: 'reduce' });
      await context.addInitScript((language) => localStorage.setItem('seventeen-locale', language), locale);
      const page = await context.newPage(); page.setDefaultTimeout(8000);
      page.on('pageerror', (e) => results.pageErrors.push({ locale, message: e.message }));
      page.on('requestfailed', (r) => results.failedRequests.push({ locale, endpoint: new URL(r.url()).pathname, error: r.failure()?.errorText }));
      const response = await page.goto(base, { waitUntil: 'networkidle' }); assert.equal(response.status(), 200);
      await page.waitForFunction((language) => document.documentElement.lang === language, locale === 'zh' ? 'zh-CN' : 'en');
      const nav = page.getByRole('navigation', { name: 'Primary navigation', exact: true });
      for (const width of [375, 639, 640, 767, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const geometry = await nav.evaluate((element) => {
          const controls = [...element.querySelectorAll('button,a')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => { const r = e.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { text: e.getAttribute('aria-label') || e.textContent.trim(), x: r.x, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, hit: e === top || e.contains(top) }; });
          return { controls, scrollWidth: document.documentElement.scrollWidth, innerWidth, headerBottom: element.parentElement.getBoundingClientRect().bottom };
        });
        results.pages.push({ locale, width, geometry });
        await check(locale + ':' + width + ':navigation-visible-and-unobscured', async () => {
          assert.ok(geometry.scrollWidth <= width, 'document overflow');
          for (const c of geometry.controls) { assert.ok(c.x >= -1 && c.right <= width + 1, 'control outside viewport: ' + c.text); assert.ok(c.hit, 'control center obscured: ' + c.text); assert.ok(c.bottom <= geometry.headerBottom + 1, 'control exceeds header: ' + c.text); }
          for (let i = 0; i < geometry.controls.length; i++) for (let j = i + 1; j < geometry.controls.length; j++) { const a = geometry.controls[i], b = geometry.controls[j]; assert.ok(Math.min(a.right,b.right) - Math.max(a.x,b.x) <= 0.5 || Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top) <= 0.5, 'overlapping controls: ' + a.text + ' / ' + b.text); }
        });
        await capture(page, locale + '-' + width + '-header', nav);
      }
      await page.setViewportSize({ width: 375, height: 900 });
      const menuButton = nav.getByRole('button', { name: locale === 'zh' ? '打开菜单' : 'Open menu', exact: true });
      const dialog = page.getByRole('dialog', { name: locale === 'zh' ? '导航菜单' : 'Navigation menu', exact: true });
      await check(locale + ':keyboard-modal-focus-escape-and-restore', async () => {
        const before = await page.evaluate(() => document.documentElement.style.overflow);
        await menuButton.focus(); await page.keyboard.press('Enter'); await dialog.waitFor();
        assert.equal(await menuButton.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.evaluate(() => document.documentElement.style.overflow), 'hidden');
        const close = dialog.getByRole('button', { name: locale === 'zh' ? '关闭菜单' : 'Close menu', exact: true }); assert.equal(await close.evaluate((e) => e === document.activeElement), true);
        const sequence = [];
        for (let i = 0; i < 8; i++) {
          await page.keyboard.press('Tab');
          const focused = await dialog.evaluate((e) => ({ tag: document.activeElement.tagName, label: document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.slice(0, 50), inside: e.contains(document.activeElement) }));
          sequence.push(focused);
          // Native dialogs allow focus into browser chrome, represented by BODY; background page controls remain inert.
          assert.ok(focused.inside || focused.tag === 'BODY', 'background page control received modal focus');
        }
        results.pages.push({ locale, scenario: 'keyboard-focus-sequence', sequence });
        for (let i = 0; i < 2; i++) { await page.keyboard.press('Shift+Tab'); assert.equal(await dialog.evaluate((e) => e.contains(document.activeElement) || document.activeElement === document.body), true, 'background page control received reverse modal focus'); }
        await capture(page, locale + '-375-keyboard-menu', dialog);
        await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
        assert.equal(await menuButton.evaluate((e) => e === document.activeElement), true); assert.equal(await page.evaluate(() => document.documentElement.style.overflow), before);
      });
      if (await dialog.count()) await page.keyboard.press('Escape');
      await check(locale + ':touch-backdrop-and-section-anchor', async () => {
        await menuButton.tap(); await dialog.waitFor(); await page.touchscreen.tap(5, 250); await dialog.waitFor({ state: 'hidden' });
        await menuButton.tap(); await dialog.waitFor(); await dialog.getByRole('button', { name: content[locale].nav.about, exact: true }).tap(); await dialog.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => { const target = document.getElementById('about').getBoundingClientRect(); return target.top >= 60 && target.top < 150; });
        assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');
        await capture(page, locale + '-375-about-anchor');
      });
      if (await dialog.count()) await page.keyboard.press('Escape');
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await check(locale + ':open-menu-resize-to-desktop-restores-focus', async () => {
        await menuButton.click(); await dialog.waitFor(); await page.setViewportSize({ width: 767, height: 900 }); assert.equal(await dialog.isVisible(), true);
        await page.setViewportSize({ width: 768, height: 900 }); await dialog.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '');
        assert.equal(await nav.getByRole('button', { name: content[locale].nav.brand, exact: true }).evaluate((e) => e === document.activeElement), true);
      });
      await check(locale + ':language-toggle-and-public-editor-boundary', async () => {
        await nav.getByRole('button', { name: content[locale].nav.switchLanguage, exact: true }).focus(); await page.keyboard.press('Enter');
        const next = locale === 'zh' ? 'en' : 'zh'; await page.waitForFunction((language) => document.documentElement.lang === language, next === 'zh' ? 'zh-CN' : 'en');
        assert.equal(await page.title(), content[next].meta.title); assert.equal(await page.locator('[data-cms-path],[contenteditable="true"],[data-homepage-editor="true"]').count(), 0);
        await nav.getByRole('button', { name: content[next].nav.switchLanguage, exact: true }).click();
        await page.waitForFunction((language) => document.documentElement.lang === language, locale === 'zh' ? 'zh-CN' : 'en');
      });
      await check(locale + ':keyboard-footer-qr-and-public-route-links', async () => {
        await page.setViewportSize({ width: 1024, height: 900 });
        const footer = page.locator('#contact'); await footer.scrollIntoViewIfNeeded();
        const qrButton = footer.getByRole('button', { name: content[locale].footer.wechatHint, exact: true });
        await qrButton.focus(); await page.mouse.move(0, 0); const qr = page.locator('#wechat-qr'); await qr.waitFor({ state: 'visible' }); await qr.locator('img').evaluate((img) => img.decode());
        await page.waitForFunction(() => ['#wechat-qr', '#contact .page-shell > div'].every((selector) => { const element = document.querySelector(selector); return element && Number(getComputedStyle(element).opacity) >= 0.99; }));
        const box = await qr.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 1024); await capture(page, locale + '-1024-footer-qr', footer);
        await nav.getByRole('button', { name: content[locale].nav.brand, exact: true }).focus(); await qr.waitFor({ state: 'hidden' });
        for (const endpoint of ['/okr','/experience','/knowledge']) { const link = nav.locator('a[href="' + endpoint + '"]'); assert.equal(await link.count(), 1); const response = await context.request.get(base + endpoint); assert.equal(response.status(), 200, endpoint); }
      });
      await context.close();
    }
    results.completed = true; results.passed = results.assertions.every((a) => a.pass); process.exitCode = results.passed ? 0 : 1;
  } catch (e) { results.infrastructureError = { message: e.message, stack: e.stack }; process.exitCode = 2; }
  finally {
    if (browser) await browser.close(); if (db) await db.$disconnect();
    if (server && server.exitCode === null && server.signalCode === null) { const exited = new Promise((resolve) => server.once('exit', resolve)); server.kill(); await exited; }
    const target = await fs.realpath(temp), tempRoot = await fs.realpath(os.tmpdir());
    assert.equal(path.dirname(target).toLowerCase(), tempRoot.toLowerCase()); assert.equal(path.basename(target), prefix + runId);
    const owner = JSON.parse(await fs.readFile(path.join(target, 'owner.json'), 'utf8')); assert.equal(owner.runId, runId); assert.equal(owner.purpose, 'public-interaction'); await fs.rm(target, { recursive: true });
    results.cleanup = { browserClosed: !browser || !browser.isConnected(), databaseDisconnected: true, ownedServerExited: !server || server.exitCode !== null || server.signalCode !== null, port3016Free: await freePort(), ownedTempDeleted: await fs.stat(target).then(() => false, () => true) };
    results.failedClassification = results.failedRequests.reduce((acc,item) => { acc[item.error] = (acc[item.error] || 0) + 1; return acc; }, {});
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify({ output, assertions: results.assertions, infrastructureError: results.infrastructureError?.message, cleanup: results.cleanup }, null, 2));
  }
}
main().catch((e) => { console.error(e.message); process.exitCode = 2; });
