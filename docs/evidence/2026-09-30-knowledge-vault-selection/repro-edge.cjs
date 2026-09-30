/* eslint-disable @typescript-eslint/no-require-imports -- Local standalone evidence runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');

const baseURL = 'http://127.0.0.1:3012';
const repo = path.resolve(__dirname, '../../..');
const runId = crypto.randomUUID();
const green = process.argv.includes('--green');
const assertViewerCleared = green || process.argv.includes('--assert');
const results = { startedAt: new Date().toISOString(), runId, mode: assertViewerCleared ? 'assert-viewer-cleared' : 'observe', scenarios: [], network: [], pageErrors: [] };
const output = path.join(__dirname, (green ? 'green-' : assertViewerCleared ? 'red-' : 'observe-') + runId);
const ownedTemp = path.join(os.tmpdir(), 'workstation-vault-selection-' + runId);
const databasePath = path.join(ownedTemp, 'test.db');
const names = { a: 'A Selection Vault', b: 'B Selection Vault', empty: 'C Empty Vault' };
const contents = {
  a: '---\ntitle: A META TITLE\nmarker: A_METADATA_ONLY\n---\n\n# A SOURCE BODY\n\nA_BODY_ONLY\n',
  b: '---\ntitle: B META TITLE\nmarker: B_METADATA_ONLY\n---\n\n# B SOURCE BODY\n\nB_BODY_ONLY\n',
};

async function portIsFree() {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(3012, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

async function snapshot(page, label) {
  const viewer = page.getByRole('region', { name: '笔记正文', exact: true });
  const state = await page.evaluate(() => {
    const viewer = document.querySelector('section[aria-label="笔记正文"]');
    const indexTitle = [...document.querySelectorAll('h2')].find((node) => node.parentElement?.querySelector('span')?.textContent === 'INDEX');
    return { indexTitle: indexTitle?.textContent, viewerPresent: Boolean(viewer),
      viewerTitle: viewer?.querySelector('strong')?.textContent ?? null,
      viewerText: viewer?.innerText ?? null,
      errors: [...(viewer?.querySelectorAll('[role="alert"]') ?? [])].map((node) => node.textContent),
      sourceRevisionIds: [...(viewer?.querySelectorAll('[id^="revision-"]') ?? [])].map((node) => node.id),
      registeredVaults: [...document.querySelectorAll('[aria-label="已登记知识库"] article strong')].map((node) => node.textContent) };
  });
  await page.getByRole('heading', { name: state.indexTitle, exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, label + '.png'), fullPage: true });
  if (state.viewerPresent) await viewer.screenshot({ path: path.join(output, label + '-viewer.png') });
  await fs.writeFile(path.join(output, label + '-dom.json'), JSON.stringify(state, null, 2) + '\n');
  return state;
}

async function run() {
  await fs.mkdir(output, { recursive: true });
  assert.equal(await portIsFree(), true, '3012 must be unoccupied; never reuse or stop an unowned server');
  await fs.mkdir(ownedTemp);
  await fs.writeFile(path.join(ownedTemp, 'owner.json'), JSON.stringify({ runId, purpose: 'knowledge-vault-selection' }));
  await fs.copyFile(process.env.CODEY_SOURCE_DB || 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db', databasePath);
  for (const key of ['a', 'b', 'empty']) {
    await fs.mkdir(path.join(ownedTemp, key));
    if (contents[key]) await fs.writeFile(path.join(ownedTemp, key, 'same.md'), contents[key]);
  }
  const requireRuntime = createRequire(path.join(process.env.CODEY_RUNTIME_MODULES || 'C:/Users/23399/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', 'package.json'));
  const requireRepo = createRequire(path.join(repo, 'package.json'));
  const { chromium } = requireRuntime('playwright');
  const { PrismaClient } = requireRepo('@prisma/client');
  const databaseURL = 'file:' + databasePath.replaceAll('\\', '/');
  const db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
  let server; let browser;
  results.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', windowsHide: true }).trim();
  results.knowledgeSourceHash = crypto.createHash('sha256').update(await fs.readFile(path.join(repo, 'src/components/admin/KnowledgeWorkspace.tsx'))).digest('hex');
  try {
    // Only the disposable copy is emptied; scans create every test note/revision.
    for (const model of ['knowledgeCollectionArticle', 'knowledgeArticleAttachment', 'knowledgeArticle', 'knowledgePublicationDraftAttachment', 'knowledgeAttachmentTransferRequest', 'knowledgePublicationDraft', 'knowledgeVault']) await db[model].deleteMany();
    assert.equal(await db.knowledgeVault.count(), 0);
    const user = await db.user.create({ data: { username: 'vault-selection-' + runId, passwordHash: 'not-a-login-password', isActive: true } });
    const token = crypto.randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
    server = spawn(process.execPath, [path.join(repo, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '3012'], { cwd: repo, env: { ...process.env, DATABASE_URL: databaseURL }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Local server startup timeout')), 15000);
      server.once('error', (error) => { clearTimeout(timeout); reject(error); });
      server.once('exit', (code) => { clearTimeout(timeout); reject(new Error('Local server exit ' + code)); });
      server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Ready')) { clearTimeout(timeout); resolve(); } });
    });
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    results.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await context.addCookies([{ name: 'workstation_session', value: token, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', (error) => results.pageErrors.push(error.message));
    const api = async (method, endpoint, data) => {
      const response = await context.request.fetch(baseURL + endpoint, { method, data });
      const json = await response.json();
      assert.ok(response.ok(), method + ' ' + endpoint + ' status=' + response.status());
      return json;
    };
    const vaults = {};
    for (const key of ['a', 'b']) {
      vaults[key] = await api('POST', '/api/admin/knowledge/vaults', { name: names[key], rootPath: path.join(ownedTemp, key), ignorePatterns: [], enabled: true });
      vaults[key] = await api('POST', '/api/admin/knowledge/vaults/' + vaults[key].id + '/scan');
      assert.equal(vaults[key].notes.length, 1);
      assert.equal(vaults[key].sourceRevisions.length, 1);
      const stored = await db.knowledgeVault.findUniqueOrThrow({ where: { id: vaults[key].id }, include: { notes: true, sourceRevisions: true } });
      assert.equal(stored.notes[0].relativePath, 'same.md');
      assert.equal(stored.sourceRevisions[0].markdown, contents[key]);
      results[key + 'Index'] = { id: stored.id, name: stored.name, note: { id: stored.notes[0].id, relativePath: stored.notes[0].relativePath, frontmatterJson: stored.notes[0].frontmatterJson }, revision: { id: stored.sourceRevisions[0].id, origin: stored.sourceRevisions[0].origin, relativePath: stored.sourceRevisions[0].relativePath, markdown: stored.sourceRevisions[0].markdown } };
    }
    const responseTasks = new Set();
    page.on('response', (response) => {
      const endpoint = new URL(response.url()).pathname;
      if (!endpoint.startsWith('/api/admin/knowledge/vaults')) return;
      const task = response.json().then((data) => results.network.push({ method: response.request().method(), endpoint, query: new URL(response.url()).search, status: response.status(), data }));
      responseTasks.add(task); task.finally(() => responseTasks.delete(task));
    });
    const openA = async () => {
      await page.goto(baseURL + '/admin/knowledge', { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: names.a }).click();
      const loaded = page.waitForResponse((response) => response.url().includes('/' + vaults.a.id + '/notes?') && response.status() === 200);
      await page.getByRole('button', { name: '查看笔记', exact: true }).click();
      await loaded;
      await page.getByRole('region', { name: '笔记正文', exact: true }).getByText('A_BODY_ONLY', { exact: true }).waitFor();
    };
    if (green) {
      await fs.mkdir(path.join(ownedTemp, 'fallback'));
      vaults.fallback = await api('POST', '/api/admin/knowledge/vaults', { name: 'D Empty Fallback', rootPath: path.join(ownedTemp, 'fallback'), ignorePatterns: [], enabled: true });
    }
    await openA();
    await snapshot(page, '01-add-baseline-a');
    await page.locator('input[name="name"]').fill(names.empty);
    await page.locator('input[name="rootPath"]').fill(path.join(ownedTemp, 'empty'));
    const created = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/admin/knowledge/vaults' && response.request().method() === 'POST' && response.status() === 201);
    await page.getByRole('button', { name: '登记知识库', exact: true }).click();
    vaults.empty = await (await created).json();
    await page.getByRole('heading', { name: names.empty, exact: true }).waitFor();
    // Complete the actual note read when present, without relying on a test timeout.
    await page.waitForLoadState('networkidle');
    const addState = await snapshot(page, '02-add-empty-selected');
    results.scenarios.push({ name: 'add-empty-vault-clears-viewer', expectedViewerPresent: false, observed: addState, fixtureEmpty: (await db.knowledgeNote.count({ where: { vaultId: vaults.empty.id } })) === 0 });

    await openA();
    await snapshot(page, '03-remove-baseline-a');
    const aCard = page.getByRole('complementary', { name: '已登记知识库' }).locator('article').filter({ has: page.getByRole('button', { name: names.a }) });
    await aCard.getByRole('button', { name: '移除', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '移除知识库登记', exact: true });
    await dialog.waitFor();
    await page.screenshot({ path: path.join(output, '04-remove-confirm.png'), fullPage: true });
    const removed = page.waitForResponse((response) => response.request().method() === 'DELETE' && new URL(response.url()).pathname.endsWith('/' + vaults.a.id) && response.status() === 200);
    await dialog.getByRole('button', { name: '确认移除', exact: true }).click();
    await removed;
    await page.getByRole('heading', { name: names.b, exact: true }).waitFor();
    await page.waitForLoadState('networkidle');
    const removeState = await snapshot(page, '05-remove-a-fallback-b');
    assert.equal(await db.knowledgeVault.count({ where: { id: vaults.a.id } }), 0, 'A registration actually removed');
    assert.equal(await fs.readFile(path.join(ownedTemp, 'a', 'same.md'), 'utf8'), contents.a, 'A source preserved after removal');
    const freshB = await api('GET', '/api/admin/knowledge/vaults/' + vaults.b.id + '/notes?path=same.md');
    assert.equal(freshB.content, contents.b);
    results.scenarios.push({ name: 'remove-selected-vault-clears-viewer', expectedViewerPresent: false, observed: removeState, freshBContent: freshB.content, removedAInDatabase: true, sourceAUnchanged: true });
    if (green) {
      // B is the automatic fallback with selectedId still empty. Open its note
      // without explicitly selecting the vault so the fallback identity is tested.
      await page.getByRole('button', { name: '查看笔记', exact: true }).click();
      const viewer = page.getByRole('region', { name: '笔记正文', exact: true });
      await viewer.getByText('B_BODY_ONLY', { exact: true }).waitFor();
      const cards = page.getByRole('complementary', { name: '已登记知识库' }).locator('article');
      await cards.filter({ has: page.getByRole('button', { name: names.empty }) }).getByRole('button', { name: '移除', exact: true }).click();
      await dialog.getByRole('button', { name: '确认移除', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.waitForLoadState('networkidle');
      const unrelated = await snapshot(page, '06-remove-unselected-c-retains-b');
      assert.equal(unrelated.viewerTitle, 'B META TITLE');
      assert.ok(unrelated.viewerText.includes('B_BODY_ONLY'));
      results.scenarios.push({ name: 'remove-unselected-vault-retains-current-viewer', expectedViewerPresent: true, observed: unrelated });
      await cards.filter({ has: page.getByRole('button', { name: names.b }) }).getByRole('button', { name: '移除', exact: true }).click();
      await dialog.getByRole('button', { name: '确认移除', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      await page.getByRole('heading', { name: 'D Empty Fallback', exact: true }).waitFor();
      await page.waitForLoadState('networkidle');
      const fallback = await snapshot(page, '07-remove-automatic-fallback-clears-viewer');
      assert.equal(await db.knowledgeVault.count({ where: { id: vaults.b.id } }), 0);
      assert.equal(await fs.readFile(path.join(ownedTemp, 'b', 'same.md'), 'utf8'), contents.b);
      results.scenarios.push({ name: 'remove-automatic-fallback-vault-clears-viewer', expectedViewerPresent: false, observed: fallback });
    }
    await Promise.all([...responseTasks]);
    results.captureCompleted = true;
    results.fixture = { relativePath: 'same.md', createdVia: 'real authenticated POST', indexedVia: 'real authenticated scan API', emptyVaultId: vaults.empty.id };
    if (assertViewerCleared) {
      for (const scenario of results.scenarios) {
        try {
          assert.equal(scenario.observed.viewerPresent, scenario.expectedViewerPresent, scenario.name + ': viewer must belong to the current selected vault');
          scenario.assertion = { pass: true };
        } catch (error) {
          // Record each actual assertion failure; the first RED does not block the second.
          scenario.assertion = { pass: false, code: error.code, actual: error.actual, expected: error.expected, error: error.message };
        }
      }
      results.assertionsPassed = results.scenarios.every((scenario) => scenario.assertion.pass);
      if (!results.assertionsPassed) process.exitCode = 1;
    }
  } catch (error) {
    results.infrastructureError = error.message;
    process.exitCode = 2;
  } finally {
    if (browser) await browser.close();
    await db.$disconnect();
    if (server && server.exitCode === null) { const exited = new Promise((resolve) => server.once('exit', resolve)); server.kill(); await exited; }
    const tempRoot = await fs.realpath(os.tmpdir());
    const target = await fs.realpath(ownedTemp);
    const owner = JSON.parse(await fs.readFile(path.join(target, 'owner.json'), 'utf8'));
    assert.equal(owner.runId, runId);
    assert.ok(target.toLowerCase().startsWith(tempRoot.toLowerCase() + path.sep));
    assert.equal(path.basename(target), 'workstation-vault-selection-' + runId);
    await fs.rm(target, { recursive: true });
    results.cleanup = { browserClosed: !browser || !browser.isConnected(), databaseDisconnected: true, ownedServerExited: !server || server.exitCode !== null || server.signalCode !== null, port3012Closed: await portIsFree(), verifiedOwnedTempDeleted: await fs.stat(target).then(() => false, () => true) };
    results.completedAt = new Date().toISOString();
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify({ output, captureCompleted: results.captureCompleted, error: results.infrastructureError, scenarios: results.scenarios.map((item) => ({ name: item.name, viewerPresent: item.observed.viewerPresent, title: item.observed.viewerTitle, index: item.observed.indexTitle, assertion: item.assertion })), cleanup: results.cleanup }, null, 2));
  }
}
run().catch((error) => { console.error(error.message); process.exitCode = 2; });
