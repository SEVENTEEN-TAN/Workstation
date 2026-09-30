import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { copyFile, mkdtemp, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { basename, dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';

// Run from repo root; copies supplied migrated SQLite and uses existing .next only.
// SOURCE_DB, RUNTIME_PACKAGES, EDGE_EXE may override paths. Port stays 3014.
const output = dirname(fileURLToPath(import.meta.url));
const root = resolve(output, '../../..');
const require = createRequire(join(root, 'package.json'));
const runtimeRequire = createRequire(join(process.env.RUNTIME_PACKAGES ?? 'C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', 'package.json'));
const { chromium } = runtimeRequire('playwright');
const { PrismaClient } = require('@prisma/client');
const port = 3014, base = `http://127.0.0.1:${port}`;
const source = process.env.SOURCE_DB ?? 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db';
const owner = randomUUID(), prefix = 'workstation-recurrence-workspace-';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const freePort = () => new Promise((accept) => { const check = net.createServer(); check.once('error', () => accept(false)); check.listen(port, '127.0.0.1', () => check.close(() => accept(true))); });
const results = { runAt: new Date().toISOString(), assertions: [], api: [], pages: [], fixtures: [], cleanup: {} };
let temp, db, browser, server, log, token;
function check(name, assertion) { assertion(); results.assertions.push(name); }
async function api(path, method = 'GET', data) {
  const response = await fetch(base + path, { method, headers: { cookie: `workstation_session=${token}`, ...(data ? { 'content-type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
  const body = await response.json(); results.api.push({ path, method, status: response.status, body });
  assert.equal(response.status, 200, `${method} ${path}`); return body;
}
async function responseAfter(page, method, path, action) {
  const waiting = page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === method);
  await action(); const response = await waiting; const body = await response.json();
  results.api.push({ path, method, status: response.status(), body, source: 'Real Edge UI' });
  assert.equal(response.status(), method === 'POST' ? 201 : 200); await page.waitForLoadState('networkidle'); return body;
}
async function capture(page, filename, target, autoScroll = true) {
  await page.evaluate(() => document.fonts.ready);
  if (target && autoScroll) {
    await target.scrollIntoViewIfNeeded();
    await target.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }));
  }
  if (target) await target.evaluate((e) => { const r = e.getBoundingClientRect(); assertInPage(r); function assertInPage(r) { if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) throw new Error('Screenshot target clipped outside viewport'); } });
  const dom = await page.evaluate(() => ({ urlPath: location.pathname + location.hash, viewport: { width: innerWidth, height: innerHeight }, scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, title: document.querySelector('h1')?.innerText, actions: [...document.querySelectorAll('[id^="action-"]')].map((e) => ({ id: e.id, text: e.innerText, status: e.querySelector('select')?.value })), metrics: [...document.querySelectorAll('[class*="metrics"] article')].map((e) => e.innerText), dialog: [...document.querySelectorAll('[role="dialog"], dialog[open]')].map((e) => ({ text: e.innerText, scrollHeight: e.scrollHeight, clientHeight: e.clientHeight })) }));
  assert(dom.scrollWidth <= dom.viewport.width && dom.bodyScrollWidth <= dom.viewport.width, 'Horizontal page overflow');
  await page.screenshot({ path: join(output, filename), fullPage: !target });
  results.pages.push({ filename, ...dom });
}
async function setStatus(page, item, status) {
  await responseAfter(page, 'PATCH', `/api/admin/okr/action-items/${item.id}`, () => page.locator(`#action-${item.id} select`).selectOption(status));
  await page.waitForFunction(({ id, value }) => document.querySelector(`#action-${id} select`)?.value === value, { id: item.id, value: status });
}
async function createInForm(page, krId, fixture, screenshot) {
  await page.locator(`#key-result-${krId}`).getByRole('button', { name: '添加', exact: true }).click();
  const form = page.locator('form').filter({ has: page.locator('input[name="titleZh"]') });
  await form.locator('[name="titleZh"]').fill(fixture.titleZh);
  await form.locator('[name="titleEn"]').fill(fixture.titleEn);
  await form.locator('[name="dueDate"]').fill(fixture.date);
  await form.locator('[name="sortOrder"]').fill(String(fixture.sortOrder));
  await form.locator('[name="recurrenceType"]').selectOption(fixture.recurrenceType);
  await form.locator('[name="recurrenceInterval"]').fill(String(fixture.recurrenceInterval));
  for (const day of fixture.days ?? []) await form.locator(`[name="recurrenceDays"][value="${day}"]`).check();
  await capture(page, screenshot, form.getByRole('button', { name: '创建行动项', exact: true }));
  const item = await responseAfter(page, 'POST', '/api/admin/okr/action-items', () => form.getByRole('button', { name: '创建行动项', exact: true }).click());
  await page.locator(`#action-${item.id}`).waitFor(); return item;
}
async function progressSnapshot(krId) {
  const kr = await db.keyResult.findUniqueOrThrow({ where: { id: krId }, include: { progressUpdates: true } });
  return { currentValue: kr.currentValue, manualProgress: kr.manualProgress, status: kr.status, updatedAt: kr.updatedAt.toISOString(), progressUpdates: kr.progressUpdates };
}
async function recurrenceChecks(page, item, fixture, krId, before, screenshot) {
  await setStatus(page, item, 'DONE');
  const original = await db.actionItem.findUniqueOrThrow({ where: { id: item.id } });
  const children = await db.actionItem.findMany({ where: { generatedFromActionItemId: item.id } });
  check(`${fixture.recurrenceType}: exactly one derived action with hand-calculated date`, () => {
    assert.equal(children.length, 1); assert.equal(children[0].dueDate.toISOString(), fixture.expected);
    for (const field of ['keyResultId', 'titleZh', 'titleEn', 'sortOrder', 'recurrenceType', 'recurrenceInterval', 'recurrenceDays']) assert.deepEqual(children[0][field], original[field], field);
    assert.equal(children[0].status, 'TODO'); assert.equal(children[0].completedAt, null); assert.equal(children[0].hasGeneratedNext, false);
    assert.equal(original.status, 'DONE'); assert.equal(original.hasGeneratedNext, true); assert(original.completedAt); assert.equal(original.dueDate.toISOString().slice(0, 10), fixture.date);
  });
  const child = children[0];
  await page.locator(`#action-${child.id}`).waitFor();
  assert.equal(await page.locator(`[id="action-${item.id}"], [id="action-${child.id}"]`).count(), 2);
  results.assertions.push(`${fixture.recurrenceType}: current list retains original and derived rows`);
  assert.equal(await page.locator(`#action-${item.id} select`).inputValue(), 'DONE');
  assert.equal(await page.locator(`#action-${child.id} select`).inputValue(), 'TODO');
  assert((await page.locator(`#action-${child.id}`).innerText()).includes(fixture.displayDate));
  assert(await page.getByText('行动项已完成。建议记录一次 KR 进度，保持结果与执行同步。', { exact: true }).isVisible());
  assert.deepEqual(await progressSnapshot(krId), before);
  results.assertions.push(`${fixture.recurrenceType}: KR values, status, timestamp and progress history unchanged`);
  await api(`/api/admin/okr/cycles/${(await db.objective.findUniqueOrThrow({ where: { id: (await db.keyResult.findUniqueOrThrow({ where: { id: krId } })).objectiveId } })).cycleId}`);
  await capture(page, screenshot, page.locator(`#action-${child.id}`));
  await api(`/api/admin/okr/action-items/${item.id}`, 'PATCH', { status: 'DONE' });
  assert.equal(await db.actionItem.count({ where: { generatedFromActionItemId: item.id } }), 1);
  assert.equal((await db.actionItem.findUniqueOrThrow({ where: { id: item.id } })).completedAt.toISOString(), original.completedAt.toISOString());
  await setStatus(page, item, 'TODO'); await setStatus(page, item, 'DONE');
  assert.equal(await db.actionItem.count({ where: { generatedFromActionItemId: item.id } }), 1);
  results.assertions.push(`${fixture.recurrenceType}: duplicate DONE and reopen/recomplete create no duplicate`);
  await page.locator(`#action-${child.id}`).getByRole('button', { name: `删除行动项 ${fixture.titleZh}`, exact: true }).click();
  await responseAfter(page, 'DELETE', `/api/admin/okr/action-items/${child.id}`, () => page.getByRole('button', { name: '确认删除', exact: true }).click());
  await page.locator(`#action-${child.id}`).waitFor({ state: 'detached' });
  await setStatus(page, item, 'TODO'); await setStatus(page, item, 'DONE');
  assert.equal(await db.actionItem.count({ where: { generatedFromActionItemId: item.id } }), 0);
  assert.equal((await db.actionItem.findUniqueOrThrow({ where: { id: item.id } })).hasGeneratedNext, true);
  assert.deepEqual(await progressSnapshot(krId), before);
  results.assertions.push(`${fixture.recurrenceType}: deleted derived action is not regenerated on recompletion`);
  results.fixtures.push({ ...fixture, originalAfterFirstCompletion: original, childBeforeDeletion: child, originalAfterChecks: await db.actionItem.findUnique({ where: { id: item.id } }), krBefore: before, krAfter: await progressSnapshot(krId), finalChildCount: 0 });
}
try {
  assert(await freePort(), 'Port 3014 occupied; no process stopped');
  results.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  results.buildId = (await readFile(join(root, '.next/BUILD_ID'), 'utf8')).trim();
  results.sourceDigests = Object.fromEntries(await Promise.all(['src/components/admin/okr/ActionItemList.tsx', 'src/components/admin/okr/ObjectiveWorkspace.tsx', 'src/components/admin/okr/OkrCycleWorkspace.tsx', 'src/lib/services/okr.ts', 'src/lib/services/overview-queue.ts', 'src/lib/okr/recurrence.ts', 'src/lib/validators/okr.ts', 'prisma/schema.prisma', 'src/app/admin/admin.module.css'].map(async (path) => [path, digest(await readFile(join(root, path)))])));
  temp = await mkdtemp(join(tmpdir(), prefix)); await writeFile(join(temp, '.owner'), owner, { flag: 'wx' });
  const dbPath = join(temp, 'acceptance.db'); await copyFile(source, dbPath);
  const databaseUrl = `file:${dbPath.replaceAll('\\', '/')}`;
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  assert.equal(await db.okrCycle.count(), 0, 'Copied source assumes no existing cycles');
  const cycle = await db.okrCycle.create({ data: { nameZh: '重复行动工作区验收周期', nameEn: 'Recurrence workspace acceptance cycle', type: 'CUSTOM', status: 'ACTIVE', startDate: new Date('2026-09-01'), endDate: new Date('2026-12-31') } });
  const objective = await db.objective.create({ data: { cycleId: cycle.id, titleZh: '重复行动验收目标', titleEn: 'Recurrence acceptance objective', status: 'IN_PROGRESS' } });
  const metric = await db.keyResult.create({ data: { objectiveId: objective.id, titleZh: '数值KR保持25%', titleEn: 'Metric KR stays at 25%', progressMode: 'METRIC', startValue: 0, currentValue: 25, targetValue: 100, status: 'IN_PROGRESS' } });
  const manual = await db.keyResult.create({ data: { objectiveId: objective.id, titleZh: '手动KR保持35%', titleEn: 'Manual KR stays at 35%', progressMode: 'MANUAL', manualProgress: 35, status: 'IN_PROGRESS', sortOrder: 1 } });
  await db.krProgressUpdate.create({ data: { keyResultId: metric.id, currentValue: 25, calculatedProgress: 25, noteZh: '完成动作前的真实历史' } });
  await db.krProgressUpdate.create({ data: { keyResultId: manual.id, manualProgress: 35, calculatedProgress: 35, noteZh: '完成动作前的真实历史' } });
  let user = await db.user.findFirst({ where: { isActive: true } });
  if (!user) user = await db.user.create({ data: { username: 'recurrence-acceptance', passwordHash: 'unused-test-session' } });
  token = randomBytes(32).toString('base64url');
  await db.session.create({ data: { userId: user.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + 3600000), userAgent: 'Isolated recurrence acceptance' } });
  log = createWriteStream(join(temp, 'server.log'));
  server = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.pipe(log); server.stderr.pipe(log);
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/admin/login')).status === 200) break; } catch {} if (i === 79) throw new Error('Owned Next server failed to start'); await new Promise((accept) => setTimeout(accept, 250)); }
  browser = await chromium.launch({ executablePath: process.env.EDGE_EXE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  for (const [label, width, height, kr, fixture] of [
    ['desktop', 1440, 1000, metric, { titleZh: '每日复盘行动', titleEn: 'Daily review action', date: '2026-09-30', recurrenceType: 'DAILY', recurrenceInterval: 2, sortOrder: 7, expected: '2026-10-02T00:00:00.000Z', displayDate: '2026/10/2', calendarReason: 'September 30 plus two calendar days crosses into October 2.' }],
    ['mobile', 375, 900, manual, { titleZh: '双周整理行动', titleEn: 'Fortnightly organization action', date: '2026-10-01', recurrenceType: 'WEEKLY', recurrenceInterval: 2, days: [1, 4], sortOrder: 9, expected: '2026-10-12T00:00:00.000Z', displayDate: '2026/10/12', calendarReason: 'October 1 is Thursday, the final selected day. The next selected week is two weeks from the September 28 Monday anchor; its Monday is October 12.' }],
  ]) {
    const context = await browser.newContext({ viewport: { width, height }, timezoneId: 'Asia/Shanghai', locale: 'zh-CN', deviceScaleFactor: 1 });
    await context.addCookies([{ name: 'workstation_session', value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage(); const errors = [], failedRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (request) => failedRequests.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
    const cyclePath = `/admin/okr/cycles/${cycle.id}`, objectivePath = `${cyclePath}/objectives/${objective.id}`;
    assert.equal((await page.goto(base + cyclePath, { waitUntil: 'networkidle' })).status(), 200);
    await capture(page, `01-cycle-${label}.png`);
    await page.getByRole('link', { name: '进入目标', exact: true }).click(); await page.waitForURL(base + objectivePath); await page.waitForLoadState('networkidle');
    const before = await progressSnapshot(kr.id);
    const item = await createInForm(page, kr.id, fixture, `02-form-${label}.png`);
    await recurrenceChecks(page, item, fixture, kr.id, before, `03-completed-${label}.png`);
    // A separate due-today action exercises actual dashboard link, independent of fixed recurrence dates.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const direct = await createInForm(page, kr.id, { titleZh: `仪表盘直达-${label}`, titleEn: `Dashboard direct ${label}`, date: today, recurrenceType: 'NONE', recurrenceInterval: 1, sortOrder: 12 }, `04-dashboard-action-form-${label}.png`);
    const queue = await api('/api/admin/overview-queue');
    const entry = queue.todayActions.find((e) => e.id === direct.id);
    assert(entry); assert.equal(entry.href, `${objectivePath}#action-${direct.id}`);
    assert(!queue.todayActions.some((e) => e.id === item.id), 'Completed original must not appear as today action');
    assert.equal((await page.goto(base + '/admin', { waitUntil: 'networkidle' })).status(), 200);
    const link = page.locator(`a[href="${entry.href}"]`); await link.waitFor(); await capture(page, `05-dashboard-${label}.png`, link);
    await link.click(); await page.waitForURL(base + entry.href); await page.waitForLoadState('networkidle');
    const target = page.locator(`#action-${direct.id}`); await target.waitFor();
    const autoLocatedWithin5s = await page.waitForFunction((id) => { const r = document.getElementById(`action-${id}`)?.getBoundingClientRect(); return r && r.top >= 0 && r.bottom <= innerHeight; }, direct.id, { timeout: 5000 }).then(() => true, () => false);
    const positioning = await target.evaluate((e) => { const r = e.getBoundingClientRect(); const middle = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, scrollY, hash: location.hash, withinViewport: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, unobstructed: middle === e || e.contains(middle) }; });
    positioning.autoLocatedWithin5s = autoLocatedWithin5s;
    results.pages.push({ label, dashboardTarget: direct.id, positioning });
    assert(positioning.withinViewport && positioning.unobstructed, 'Dashboard anchor must position actual row in viewport');
    results.assertions.push(`${label}: actual dashboard link locates due-today action in viewport without obstruction`);
    await capture(page, `06-dashboard-target-${label}.png`, target, false);
    await page.close(); assert.equal(errors.length, 0); results.pages.push({ label, errors, failedRequests }); await context.close();
  }
  results.finalDatabase = { cycles: await db.okrCycle.findMany({ include: { objectives: { include: { keyResults: { include: { actionItems: true, progressUpdates: true } } } } } }), actionCount: await db.actionItem.count() };
} catch (error) { results.error = error.message; results.errorStack = error.stack; process.exitCode = 1; }
finally {
  if (browser) { await browser.close(); results.cleanup.browserClosed = true; }
  if (db) await db.$disconnect(); results.cleanup.databaseDisconnected = true;
  if (server) { if (server.exitCode === null) { const exited = new Promise((accept) => server.once('exit', accept)); server.kill(); await exited; } results.cleanup.serverStopped = true; }
  if (log) await new Promise((accept) => log.end(accept));
  results.cleanup.portFree = await freePort();
  if (temp) {
    const resolvedTemp = await realpath(temp), resolvedRoot = await realpath(tmpdir());
    assert.equal(dirname(resolvedTemp).toLowerCase(), resolvedRoot.toLowerCase());
    assert.equal(basename(resolvedTemp), basename(temp)); assert(basename(resolvedTemp).startsWith(prefix));
    assert.equal(await readFile(join(resolvedTemp, '.owner'), 'utf8'), owner);
    results.cleanup.ownerAndResolvedPathVerified = true;
    await rm(resolvedTemp, { recursive: true, force: true }); results.cleanup.temporaryDirectoryRemoved = true;
  }
  await writeFile(join(output, 'dom-api-db-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify({ head: results.head, assertions: results.assertions.length, screenshots: results.pages.filter((p) => p.filename).length, api: results.api.length, error: results.error, cleanup: results.cleanup }));
}
