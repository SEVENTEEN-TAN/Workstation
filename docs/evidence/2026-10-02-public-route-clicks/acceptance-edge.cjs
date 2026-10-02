/* eslint-disable @typescript-eslint/no-require-imports -- Isolated public route acceptance. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../..');
const runtimeRequire = createRequire('C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/package.json');
const { chromium } = runtimeRequire('playwright');
const { PrismaClient } = createRequire(path.join(repo, 'package.json'))('@prisma/client');
const baseURL = 'http://127.0.0.1:3023';
const entries = [
  ['nav-okr', '/okr', 'header', ['让目标清晰可见。', 'GOALS, MADE VISIBLE.']],
  ['nav-journey', '/experience', 'header', ['让职业路径可追溯。', 'A TRACEABLE PATH.']],
  ['nav-knowledge', '/knowledge', 'header', ['公开知识库。', '公开知识库。']],
  ['about-skills', '/skills', '#about', ['让能力有证据。', 'SKILLS WITH EVIDENCE.']],
  ['now-activities', '/activities', '#now', ['持续行动，持续积累。', 'WORK IN MOTION.']],
  ['work-projects', '/projects', '#work', ['让项目经验可验证。', 'WORK THAT CAN BE VERIFIED.']],
  ['capability-skills', '/skills', '#capability', ['让能力有证据。', 'SKILLS WITH EVIDENCE.']],
  ['journey-full', '/experience', '#journey', ['让职业路径可追溯。', 'A TRACEABLE PATH.']],
  ['journey-resume', '/resume', '#journey', ['SEVENTEEN', 'SEVENTEEN']],
];
const sourceFiles = [
  'src/components/public/Navbar.tsx', 'src/components/public/HomeExperience.tsx',
  'src/components/public/About.tsx', 'src/components/public/HomeNow.tsx',
  'src/components/public/RecentWorks.tsx', 'src/components/public/HomeCapabilities.tsx',
  'src/components/public/HomeJourney.tsx', 'src/components/public/i18n.tsx',
  'src/components/public/OkrExperience.tsx', 'src/components/public/ExperienceTimeline.tsx',
  'src/components/public/SkillCapabilitiesExperience.tsx', 'src/components/public/ActivityExperience.tsx',
  'src/components/public/ProjectExperience.tsx', 'src/components/public/PrintableResume.tsx',
  'src/components/public/ResumeToolbar.tsx', 'src/app/globals.css',
  ...['page', 'okr/page', 'experience/page', 'knowledge/page', 'skills/page', 'activities/page', 'projects/page', 'resume/page'].map((file) => 'src/app/' + file + '.tsx'),
];

(async () => {
  const scratch = path.join(repo, '.superpowers/public-route-clicks');
  await fs.mkdir(scratch, { recursive: true });
  const databasePath = path.join(scratch, crypto.randomUUID() + '.db');
  await fs.copyFile('C:/Users/23399/AppData/Local/Temp/workstation-home-image-74cc5c8774f0499cbb1f13fc7f4e6c3f.db', databasePath);
  const databaseURL = 'file:' + databasePath.replaceAll('\\', '/');
  const db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
  const result = { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), buildId: (await fs.readFile(path.join(repo, '.next/BUILD_ID'), 'utf8')).trim(), databasePath, results: [], pageErrors: [], failedRequests: [], httpErrors: [] };
  let browser, server;
  try {
    result.resumeFiles = await db.resumeFile.count();
    assert.equal(result.resumeFiles, 0, 'Online resume fixture must have no PDF files');
    const area = await db.skillArea.create({ data: {
      nameZh: '路由验收能力样例', nameEn: 'Route acceptance capability',
      descriptionZh: '仅用于隔离库的虚构验收记录。', descriptionEn: 'Synthetic record in the isolated acceptance database.', visibility: 'PUBLIC',
      skills: { create: { nameZh: '验收技能', nameEn: 'Acceptance skill', summaryZh: '验证公开入口。', summaryEn: 'Verify public entry routes.', visibility: 'PUBLIC',
        evidence: { create: { kind: 'ARTICLE', titleZh: '虚构文章证据', titleEn: 'Synthetic article evidence', url: baseURL + '/knowledge' } } } },
    } });
    result.syntheticSkillArea = area.id;
    server = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3023'], { cwd: repo, env: { ...process.env, DATABASE_URL: databaseURL }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 15000);
      server.once('error', reject);
      server.once('exit', (code) => reject(new Error('Server exited: ' + code)));
      server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Ready')) { clearTimeout(timeout); resolve(); } });
    });
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    result.browser = browser.version();
    for (const width of [1440, 375]) for (const locale of ['zh', 'en']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, locale: locale === 'zh' ? 'zh-CN' : 'en-US' });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      page.on('pageerror', (error) => result.pageErrors.push(error.message));
      page.on('requestfailed', (request) => result.failedRequests.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
      page.on('response', (response) => { if (response.status() >= 400) result.httpErrors.push({ path: new URL(response.url()).pathname, status: response.status() }); });
      await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction((lang) => document.documentElement.lang === lang, locale === 'zh' ? 'zh-CN' : 'en');
      const homeHeading = await page.locator('h1').getAttribute('aria-label');
      for (const [name, route, scope, headings] of entries) {
        const entry = { width, locale, name, route, pass: false };
        result.results.push(entry);
        if (scope === 'header' && width === 375) {
          await page.getByRole('button', { name: locale === 'zh' ? '打开菜单' : 'Open menu', exact: true }).click();
        }
        const origin = scope === 'header' && width === 375 ? page.locator('dialog[open]') : page.locator(scope);
        const link = origin.locator(`a[href="${route}"]`).first();
        entry.linkText = await link.innerText();
        await link.click();
        await page.waitForURL(baseURL + route);
        const expectedHeading = headings[locale === 'zh' ? 0 : 1];
        await page.getByRole('heading', { level: 1, name: expectedHeading, exact: true }).waitFor();
        const heading = page.getByRole('heading', { level: 1, name: expectedHeading, exact: true });
        assert.ok(await heading.isVisible());
        assert.equal(await page.locator('[data-cms-path], [data-homepage-editor="true"]').count(), 0);
        assert.equal(await page.locator('dialog[open]').count(), 0);
        entry.heading = await heading.innerText();
        entry.geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow: document.documentElement.style.overflow }));
        assert.ok(entry.geometry.scrollWidth <= width, 'Destination must fit viewport');
        assert.notEqual(entry.geometry.overflow, 'hidden', 'Mobile menu must restore scrolling');
        if (route === '/skills') assert.ok(await page.getByRole('heading', { name: locale === 'zh' ? '路由验收能力样例' : 'Route acceptance capability', exact: true }).isVisible());
        if (route === '/resume') {
          assert.equal(await page.locator('a[href^="/api/resume/"]').count(), 0);
          assert.ok(await page.getByRole('button', { name: locale === 'zh' ? '打印简历' : 'Print resume', exact: true }).isVisible());
          entry.noPdfOnlineResume = true;
        }
        if (name === 'nav-knowledge' || name === 'journey-resume') {
          await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
          await page.waitForFunction(() => window.scrollY === 0);
          await page.screenshot({ path: path.join(__dirname, `${width}-${locale}-${name}.png`) });
        }
        await page.goBack({ waitUntil: 'domcontentloaded' });
        await page.waitForURL(baseURL + '/');
        await page.getByRole('heading', { level: 1, name: homeHeading, exact: true }).waitFor();
        assert.equal(await page.locator('dialog[open]').count(), 0, 'Back must not reopen menu');
        await page.goForward({ waitUntil: 'domcontentloaded' });
        await page.waitForURL(baseURL + route);
        await page.getByRole('heading', { level: 1, name: expectedHeading, exact: true }).waitFor();
        await page.locator('a[href="/"]').first().click();
        await page.waitForURL(baseURL + '/');
        await page.getByRole('heading', { level: 1, name: homeHeading, exact: true }).waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem('seventeen-locale')), locale);
        assert.notEqual(await page.evaluate(() => document.documentElement.style.overflow), 'hidden');
        entry.historyBackForward = true;
        entry.homeLinkReturned = true;
        entry.pass = true;
        console.log(JSON.stringify({ width, locale, name, pass: true }));
      }
      await context.close();
    }
    assert.deepEqual(result.pageErrors, []);
    assert.deepEqual(result.httpErrors, []);
    assert.equal(result.failedRequests.filter((request) => request.error !== 'net::ERR_ABORTED').length, 0);
    assert.equal(result.results.length, 36);
    result.pass = true;
  } catch (error) { result.error = error.message; result.pass = false; process.exitCode = 1; }
  finally {
    if (browser) await browser.close();
    await db.$disconnect();
    if (server && server.exitCode === null && server.signalCode === null) { const exited = new Promise((resolve) => server.once('exit', resolve)); server.kill(); await exited; }
    result.cleanup = { browserClosed: !browser || !browser.isConnected(), databaseDisconnected: true, serverExited: !server || server.exitCode !== null || server.signalCode !== null, databaseDeleted: false };
    result.sourceHashes = await Promise.all(sourceFiles.map(async (file) => ({ path: file, sha256: crypto.createHash('sha256').update(await fs.readFile(path.join(repo, file))).digest('hex') })));
    await fs.writeFile(path.join(__dirname, 'results.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ pass: result.pass, passed: result.results.filter((entry) => entry.pass).length, total: result.results.length, error: result.error, pageErrors: result.pageErrors, httpErrors: result.httpErrors, cleanup: result.cleanup }));
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
