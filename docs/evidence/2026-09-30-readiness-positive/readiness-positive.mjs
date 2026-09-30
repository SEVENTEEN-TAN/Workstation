import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, writeFile, readFile, mkdir, rm, realpath } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { basename, dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';

// Rerun from the repository root. Uses the existing .next build; never builds.
// SOURCE_DB, RUNTIME_PACKAGES and EDGE_EXE may override local paths. Port is fixed.
const output = dirname(fileURLToPath(import.meta.url));
const root = resolve(output, '../../..');
const require = createRequire(join(root, 'package.json'));
const runtimeRequire = createRequire(join(process.env.RUNTIME_PACKAGES ?? 'C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', 'package.json'));
const { chromium } = runtimeRequire('playwright');
const { PrismaClient } = require('@prisma/client');
const port = 3013;
const base = `http://127.0.0.1:${port}`;
const source = process.env.SOURCE_DB ?? 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db';
const owner = randomUUID();
const prefix = 'workstation-readiness-positive-';
let temp, db, browser, server, log;
const freePort = () => new Promise((accept) => { const check = net.createServer(); check.once('error', () => accept(false)); check.listen(port, '127.0.0.1', () => check.close(() => accept(true))); });
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const results = { runAt: new Date().toISOString(), source: 'Copied supplied SQLite; fixtures and PDF files only in owned Temp directory', pages: [], api: [], cleanup: {} };
function fixturePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const content = 'BT /F1 14 Tf 72 720 Td (Isolated readiness acceptance resume) Tj ET\n';
  objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`);
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
try {
  assert(await freePort(), `Port ${port} is already occupied; no service stopped`);
  results.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  results.buildId = (await readFile(join(root, '.next/BUILD_ID'), 'utf8')).trim();
  results.sourceDigests = Object.fromEntries(await Promise.all([
    'src/lib/public-readiness.ts', 'src/lib/okr/public-readiness.ts', 'src/lib/services/resume-files.ts',
    'src/components/admin/okr/PublicReadiness.tsx', 'src/components/admin/PortfolioProjectsWorkspace.tsx',
    'src/components/admin/ExperienceRecordsWorkspace.tsx', 'src/components/admin/SkillAreasWorkspace.tsx',
    'src/components/admin/ResumeFilesWorkspace.tsx', 'src/components/admin/CareerActivitiesWorkspace.tsx',
    'src/components/admin/okr/OkrCycleListWorkspace.tsx', 'src/app/admin/admin.module.css',
  ].map(async (path) => [path, digest(await readFile(join(root, path)))])));
  temp = await mkdtemp(join(tmpdir(), prefix));
  await writeFile(join(temp, '.owner'), owner, { flag: 'wx' });
  const dbPath = join(temp, 'acceptance.db');
  const resumeRoot = join(temp, 'resumes');
  await mkdir(resumeRoot);
  await copyFile(source, dbPath);
  const databaseUrl = `file:${dbPath.replaceAll('\\', '/')}`;
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const models = ['portfolioProject', 'experienceRecord', 'skillArea', 'resumeFile', 'careerActivity', 'okrCycle'];
  results.sourceRecordCounts = Object.fromEntries(await Promise.all(models.map(async (model) => [model, await db[model].count()])));
  assert(Object.values(results.sourceRecordCounts).every((count) => count === 0), 'Fixture assumes six empty model tables in the copied source DB');
  const project = await db.portfolioProject.create({ data: {
    slug: 'readiness-positive-project', titleZh: '公开就绪验收项目', titleEn: 'Public-ready acceptance project',
    summaryZh: '完整双语公开项目样例', summaryEn: 'Complete bilingual public project fixture',
    contextZh: '本地隔离验收背景', contextEn: 'Isolated local acceptance context',
    responsibilityZh: '完成证据验收', responsibilityEn: 'Verify acceptance evidence',
    challengeZh: '检查公开条件提示', challengeEn: 'Check public readiness hints',
    approachZh: '使用独立数据和浏览器', approachEn: 'Use isolated data and browser',
    resultZh: '六类公开条件满足', resultEn: 'Six public readiness conditions satisfied',
    technologies: ['Next.js'], links: [{ kind: 'WEBSITE', labelZh: '本地项目页', labelEn: 'Local project page', url: `${base}/projects/readiness-positive-project` }], visibility: 'PUBLIC',
  } });
  await db.experienceRecord.create({ data: { kind: 'WORK', organizationZh: '公开就绪验收机构', organizationEn: 'Readiness acceptance organization', titleZh: '验收工程师', titleEn: 'Acceptance engineer', descriptionZh: '完整双语经历样例', descriptionEn: 'Complete bilingual experience fixture', locationZh: '本地', locationEn: 'Local', startedAt: new Date('2026-01-01'), visibility: 'PUBLIC' } });
  await db.skillArea.create({ data: { nameZh: '公开就绪能力域', nameEn: 'Public-ready capability area', descriptionZh: '包含公开项目和双语文章证据', descriptionEn: 'Includes public project and bilingual article evidence', visibility: 'PUBLIC', skills: { create: { nameZh: '浏览器证据验收', nameEn: 'Browser evidence acceptance', summaryZh: '通过可核查证据验证界面', summaryEn: 'Verify UI through inspectable evidence', visibility: 'PUBLIC', evidence: { create: [{ kind: 'PROJECT', projectId: project.id }, { kind: 'ARTICLE', titleZh: '本地验收方法', titleEn: 'Local acceptance method', url: `${base}/skills`, sortOrder: 1 }] } } } } });
  await db.careerActivity.create({ data: { titleZh: '公开就绪职业动态', titleEn: 'Public-ready career activity', summaryZh: '完整双语动态样例', summaryEn: 'Complete bilingual activity fixture', occurredAt: new Date('2026-09-30'), visibility: 'PUBLIC' } });
  await db.okrCycle.create({ data: { nameZh: '公开就绪验收周期', nameEn: 'Public-ready acceptance cycle', type: 'QUARTER', status: 'ACTIVE', startDate: new Date('2026-07-01'), endDate: new Date('2026-09-30'), visibility: 'PUBLIC' } });
  const pdf = fixturePdf();
  for (const locale of ['ZH', 'EN']) {
    const filename = `acceptance-resume-${locale.toLowerCase()}.pdf`;
    const storagePath = join(resumeRoot, filename);
    await writeFile(storagePath, pdf, { flag: 'wx' });
    await db.resumeFile.create({ data: { locale, originalFilename: filename, storagePath, mimeType: 'application/pdf', sizeBytes: pdf.length, sha256: digest(pdf), visibility: 'PUBLIC' } });
  }
  results.fixtures = {
    projects: await db.portfolioProject.findMany({ select: { id: true, slug: true, titleZh: true, titleEn: true, visibility: true } }),
    experience: await db.experienceRecord.findMany({ select: { organizationZh: true, organizationEn: true, visibility: true } }),
    skills: await db.skillArea.findMany({ select: { nameZh: true, nameEn: true, visibility: true, skills: { select: { nameZh: true, nameEn: true, summaryEn: true, visibility: true, evidence: { select: { kind: true, projectId: true, titleZh: true, titleEn: true, url: true } } } } } }),
    resumes: await db.resumeFile.findMany({ select: { locale: true, originalFilename: true, mimeType: true, sizeBytes: true, visibility: true } }),
    activities: await db.careerActivity.findMany({ select: { titleZh: true, titleEn: true, summaryEn: true, visibility: true } }),
    cycles: await db.okrCycle.findMany({ select: { nameZh: true, nameEn: true, type: true, status: true, visibility: true } }),
  };
  let user = await db.user.findFirst({ where: { isActive: true } });
  if (!user) user = await db.user.create({ data: { username: 'positive-acceptance', passwordHash: 'unused-test-session' } });
  const token = randomBytes(32).toString('base64url');
  await db.session.create({ data: { userId: user.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + 3600000), userAgent: 'Isolated positive readiness acceptance' } });
  await db.$disconnect(); db = null;
  log = createWriteStream(join(temp, 'server.log'));
  server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl, RESUME_UPLOAD_DIR: resumeRoot }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.pipe(log); server.stderr.pipe(log);
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/admin/login')).status === 200) break; } catch {} if (i === 79) throw new Error('Isolated Next server failed to start'); await new Promise((accept) => setTimeout(accept, 250)); }
  for (const slug of ['projects', 'experience', 'skills', 'resume', 'activities', 'okr']) {
    const response = await fetch(`${base}/api/admin/${slug}`, { headers: { cookie: `workstation_session=${token}` } });
    assert.equal(response.status, 200, `Admin API ${slug}`);
    const body = await response.json();
    // Resume admin API includes sha256; deliberately omit it from persisted evidence.
    if (slug === 'resume') for (const file of body) delete file.sha256;
    results.api.push({ path: `/api/admin/${slug}`, status: response.status, body });
  }
  for (const locale of ['zh', 'en']) {
    const response = await fetch(`${base}/api/resume/${locale}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/pdf'); assert.deepEqual(bytes, pdf);
    results.api.push({ path: `/api/resume/${locale}`, status: response.status, contentType: response.headers.get('content-type'), byteLength: bytes.length, matchesFixture: true });
  }
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
        const visible = (element) => { const r = element.getBoundingClientRect(); const s = getComputedStyle(element); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
        const boxes = [...document.querySelectorAll('span[class*="publicReadiness"]')].map((element) => {
          const r = element.getBoundingClientRect();
          return { text: element.innerText, left: r.left, right: r.right, height: r.height, withinViewport: r.left >= 0 && r.right <= innerWidth, children: [...element.children].map((child) => ({ text: child.textContent, scrollWidth: child.scrollWidth, clientWidth: child.clientWidth })), clippedByAncestor: (() => { for (let p = element.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (['hidden', 'clip'].includes(s.overflowY)) { const b = p.getBoundingClientRect(); if (r.top < b.top || r.bottom > b.bottom) return true; } } return false; })() };
        });
        return { title: document.querySelector('h1')?.innerText, viewport: innerWidth, viewportHeight: innerHeight, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, readiness: boxes, recordTitles: [...document.querySelectorAll('main h3, main [class*="entityHead"] h2')].map((element) => element.innerText), resumeFiles: [...document.querySelectorAll('main [class*="resumeFileMeta"] strong')].map((element) => element.innerText), actions: [...document.querySelectorAll('main button, main a, main label:has(input[type="file"])')].filter(visible).map((element) => element.getAttribute('aria-label') || element.innerText || element.getAttribute('title')) };
      });
      assert(data.scrollWidth <= width && data.bodyScrollWidth <= width, 'Horizontal overflow');
      assert.equal(data.readiness.length, slug === 'resume' ? 2 : 1);
      assert(data.readiness.every((hint) => hint.withinViewport && !hint.clippedByAncestor && hint.text.startsWith('满足前台展示条件') && hint.text.includes('展示去向：') && hint.text.includes('生效步骤：') && !hint.text.includes('暂不在前台展示')), 'Positive readiness missing or clipped');
      if (slug === 'resume') assert.deepEqual(data.resumeFiles, ['acceptance-resume-zh.pdf', 'acceptance-resume-en.pdf']);
      else assert(data.recordTitles.some((title) => title.includes('公开就绪')), 'Fixture record missing');
      const filename = `${String(number + 1).padStart(2, '0')}-${slug}-${label}.png`;
      await page.screenshot({ path: join(output, filename), fullPage: true });
      data.scrolledActions = await page.evaluate(async () => {
        const checks = [];
        for (const element of [...document.querySelectorAll('main button, main a, main label:has(input[type="file"])')].filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0)) {
          element.scrollIntoView({ block: 'center', behavior: 'instant' }); await new Promise((accept) => requestAnimationFrame(accept));
          const r = element.getBoundingClientRect(); const atCenter = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          checks.push({ text: element.getAttribute('aria-label') || element.innerText || element.getAttribute('title'), visibleAfterScroll: r.top >= 64 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, unobstructed: atCenter === element || element.contains(atCenter), scrollY });
        }
        return checks;
      });
      assert(data.scrolledActions.every((a) => a.visibleAfterScroll && a.unobstructed), 'Action cannot be reached');
      await page.close(); // Retain requestfailed events emitted during page closure.
      assert.equal(errors.length, 0, 'Browser pageerror');
      results.pages.push({ slug, label, filename, status: response.status(), ...data, errors, failedRequests });
    }
    await context.close();
  }
} catch (error) { results.error = error.message; process.exitCode = 1; }
finally {
  if (browser) { await browser.close(); results.cleanup.browserClosed = true; }
  if (db) await db.$disconnect(); results.cleanup.databaseDisconnected = true;
  if (server) { if (server.exitCode === null) { const exited = new Promise((accept) => server.once('exit', accept)); server.kill(); await exited; } results.cleanup.serverStopped = true; }
  if (log) await new Promise((accept) => log.end(accept));
  results.cleanup.portFree = await freePort();
  if (temp) {
    const resolvedTemp = await realpath(temp); const resolvedRoot = await realpath(tmpdir());
    assert.equal(dirname(resolvedTemp).toLowerCase(), resolvedRoot.toLowerCase());
    assert.equal(basename(resolvedTemp), basename(temp)); assert(basename(resolvedTemp).startsWith(prefix));
    assert.equal(await readFile(join(resolvedTemp, '.owner'), 'utf8'), owner);
    results.cleanup.ownerAndResolvedPathVerified = true;
    await rm(resolvedTemp, { recursive: true, force: true }); results.cleanup.temporaryDirectoryRemoved = true;
  }
  await writeFile(join(output, 'dom-api-db-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ head: results.head, pages: results.pages.length, apiChecks: results.api.length, hints: results.pages.reduce((n, p) => n + p.readiness.length, 0), actionChecks: results.pages.reduce((n, p) => n + p.scrolledActions.length, 0), failedRequests: results.pages.reduce((n, p) => n + p.failedRequests.length, 0), error: results.error, cleanup: results.cleanup }));
}
