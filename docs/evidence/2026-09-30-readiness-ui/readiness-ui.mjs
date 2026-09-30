import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomBytes } from 'node:crypto';
import { copyFile, mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { basename, dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import net from 'node:net';

// Rerun: node docs/evidence/2026-09-30-readiness-ui/readiness-ui.mjs
// Override SOURCE_DB, RUNTIME_PACKAGES, EDGE_EXE and PORT as needed. No source DB writes.
const output = dirname(fileURLToPath(import.meta.url));
const root = resolve(output, '../../..');
const require = createRequire(join(root, 'package.json'));
const runtimeRequire = createRequire(join(process.env.RUNTIME_PACKAGES ?? 'C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', 'package.json'));
const { chromium } = runtimeRequire('playwright');
const { PrismaClient } = require('@prisma/client');
const port = Number(process.env.PORT ?? 3012);
const base = `http://127.0.0.1:${port}`;
const source = process.env.SOURCE_DB ?? 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db';
const temp = await mkdtemp(join(tmpdir(), 'workstation-readiness-ui-'));
const dbPath = join(temp, 'acceptance.db');
let db, browser, server;
const freePort = () => new Promise((accept) => { const check = net.createServer(); check.once('error', () => accept(false)); check.listen(port, '127.0.0.1', () => check.close(() => accept(true))); });
const results = { runAt: new Date().toISOString(), viewportHeights: { desktop: 1000, mobile: 900 }, source: 'Copied supplied source SQLite; only the copy is writable', synthetic: [], pages: [], cleanup: {} };
try {
  assert(await freePort(), `Port ${port} is already occupied`);
  await copyFile(source, dbPath);
  const databaseUrl = `file:${dbPath.replaceAll('\\', '/')}`;
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  results.seedCounts = Object.fromEntries(await Promise.all(['portfolioProject', 'experienceRecord', 'skillArea', 'resumeFile', 'careerActivity', 'okrCycle'].map(async (model) => [model, await db[model].count()])));
  if (!results.seedCounts.portfolioProject) {
    await db.portfolioProject.create({ data: { slug: 'readiness-visual-project', titleZh: '视觉验收项目', summaryZh: '独立测试库中的公开条件样例', contextZh: '测试背景', responsibilityZh: '测试职责', challengeZh: '测试挑战', approachZh: '测试方案', resultZh: '测试结果', technologies: ['Next.js'], links: [], visibility: 'PRIVATE' } }); results.synthetic.push('portfolioProject');
  }
  if (!results.seedCounts.experienceRecord) {
    await db.experienceRecord.create({ data: { kind: 'WORK', organizationZh: '视觉验收机构', titleZh: '测试工程师', descriptionZh: '独立测试库中的经历记录', startedAt: new Date('2026-01-01'), visibility: 'PRIVATE' } }); results.synthetic.push('experienceRecord');
  }
  if (!results.seedCounts.skillArea) {
    await db.skillArea.create({ data: { nameZh: '视觉验收能力', descriptionZh: '独立测试库中的能力记录', visibility: 'PRIVATE' } }); results.synthetic.push('skillArea');
  }
  if (!results.seedCounts.careerActivity) {
    await db.careerActivity.create({ data: { titleZh: '视觉验收动态', summaryZh: '独立测试库中的动态记录', occurredAt: new Date('2026-09-30'), visibility: 'PRIVATE' } }); results.synthetic.push('careerActivity');
  }
  if (!results.seedCounts.okrCycle) {
    await db.okrCycle.create({ data: { nameZh: '视觉验收周期', type: 'QUARTERLY', startDate: new Date('2026-07-01'), endDate: new Date('2026-09-30'), visibility: 'PRIVATE' } }); results.synthetic.push('okrCycle');
  }
  let user = await db.user.findFirst({ where: { isActive: true } });
  if (!user) { user = await db.user.create({ data: { username: 'visual-acceptance', passwordHash: 'unused-test-session' } }); }
  const token = randomBytes(32).toString('base64url');
  await db.session.create({ data: { userId: user.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000), userAgent: 'Readiness visual acceptance isolated session' } });
  const published = await db.siteVersion.findFirst({ where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' } });
  results.brandImageProvided = Boolean(published?.content?.settings?.portraitImage);
  await db.$disconnect(); db = null;
  const log = createWriteStream(join(temp, 'server.log'));
  server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.pipe(log); server.stderr.pipe(log);
  for (let i = 0; i < 80; i++) { try { const response = await fetch(base + '/admin/login'); if (response.status === 200) break; } catch {} if (i === 79) throw new Error('Isolated Next server failed to start'); await new Promise((accept) => setTimeout(accept, 250)); }
  browser = await chromium.launch({ executablePath: process.env.EDGE_EXE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  for (const [label, width, height] of [['desktop', 1440, 1000], ['mobile', 375, 900]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    await context.addCookies([{ name: 'workstation_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
    for (const [number, slug] of ['projects', 'experience', 'skills', 'resume', 'activities', 'okr'].entries()) {
      const page = await context.newPage(); const errors = []; const failedRequests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('requestfailed', (request) => failedRequests.push({ urlPath: new URL(request.url()).pathname, error: request.failure()?.errorText }));
      const response = await page.goto(`${base}/admin/${slug}`, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200); assert.equal(new URL(page.url()).pathname, `/admin/${slug}`);
      await page.locator('span[class*="publicReadiness"]').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      const data = await page.evaluate(() => {
        const visible = (element) => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'; };
        const boxes = [...document.querySelectorAll('span[class*="publicReadiness"]')].map((element) => {
          const rect = element.getBoundingClientRect();
          const children = [...element.children].map((child) => { const box = child.getBoundingClientRect(); return { text: child.textContent, left: box.left, right: box.right, height: box.height, scrollWidth: child.scrollWidth, clientWidth: child.clientWidth }; });
          return { text: element.innerText, left: rect.left, right: rect.right, height: rect.height, children, withinViewport: rect.left >= 0 && rect.right <= innerWidth, clippedByAncestor: (() => { for (let parent = element.parentElement; parent; parent = parent.parentElement) { const style = getComputedStyle(parent); if (['hidden', 'clip'].includes(style.overflowY)) { const bounds = parent.getBoundingClientRect(); if (rect.top < bounds.top || rect.bottom > bounds.bottom) return true; } } return false; })() };
        });
        return { title: document.querySelector('h1')?.innerText, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, readiness: boxes, actions: [...document.querySelectorAll('main button, main a')].filter(visible).map((element) => ({ text: element.getAttribute('aria-label') || element.innerText || element.getAttribute('title'), top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })), brandImages: [...document.querySelectorAll('aside img, header img')].filter(visible).map((image) => ({ complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, urlPath: new URL(image.src).pathname })), recordTitles: [...document.querySelectorAll('main h3, main [class*="entityHead"] h2')].map((element) => element.innerText) };
      });
      assert(data.scrollWidth <= width && data.bodyScrollWidth <= width, 'Horizontal overflow');
      assert(data.readiness.every((hint) => hint.withinViewport && !hint.clippedByAncestor), 'Readiness clipped');
      if (results.brandImageProvided) assert(data.brandImages.length > 0 && data.brandImages.every((image) => image.complete && image.naturalWidth > 0), 'Brand image failed to load');
      if (slug !== 'resume') assert(data.recordTitles.length > 0, 'Identifiable record missing');
      assert(data.readiness.length > 0);
      assert(data.readiness.every((hint) => /满足前台展示条件|暂不在前台展示/.test(hint.text) && hint.text.includes('展示去向：') && hint.text.includes('生效步骤：')));
      const filename = `${String(number + 1).padStart(2, '0')}-${slug}-${label}.png`;
      await page.screenshot({ path: join(output, filename), fullPage: true });
      data.scrolledActions = await page.evaluate(async () => {
        const actions = [...document.querySelectorAll('main button, main a')].filter((element) => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0);
        const checks = [];
        for (const element of actions) {
          element.scrollIntoView({ block: 'center', behavior: 'instant' });
          await new Promise((accept) => requestAnimationFrame(accept));
          const rect = element.getBoundingClientRect();
          const atCenter = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          checks.push({ text: element.getAttribute('aria-label') || element.innerText || element.getAttribute('title'), visibleAfterScroll: rect.top >= 64 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth, unobstructed: atCenter === element || element.contains(atCenter), scrollY });
        }
        return checks;
      });
      data.actionsReachable = data.scrolledActions.every((action) => action.visibleAfterScroll && action.unobstructed);
      assert(data.actionsReachable, 'Main action cannot be reached by scrolling');
      results.pages.push({ slug, label, filename, status: response.status(), ...data, errors, failedRequests });
      await page.close();
    }
    await context.close();
  }
} catch (error) { results.error = error.message; process.exitCode = 1; }
finally {
  if (browser) { await browser.close(); results.cleanup.browserClosed = true; }
  if (db) { await db.$disconnect(); results.cleanup.databaseDisconnected = true; } else results.cleanup.databaseDisconnected = true;
  if (server) { const exited = new Promise((accept) => server.once('exit', accept)); server.kill(); await exited; results.cleanup.serverStopped = true; }
  results.cleanup.portFree = await freePort();
  const resolvedTemp = await realpath(temp);
  const resolvedTempRoot = await realpath(tmpdir());
  assert.equal(dirname(resolvedTemp).toLowerCase(), resolvedTempRoot.toLowerCase());
  assert.equal(basename(resolvedTemp), basename(temp));
  assert.ok(basename(resolvedTemp).startsWith('workstation-readiness-ui-'));
  await rm(resolvedTemp, { recursive: true, force: true }); results.cleanup.temporaryDirectoryRemoved = true;
  await writeFile(join(output, 'dom-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ pages: results.pages.length, seedCounts: results.seedCounts, synthetic: results.synthetic, brandImageProvided: results.brandImageProvided, overflow: results.pages.filter((page) => page.scrollWidth > page.viewport || page.bodyScrollWidth > page.viewport).map((page) => `${page.slug}/${page.label}`), error: results.error, cleanup: results.cleanup }));
}
