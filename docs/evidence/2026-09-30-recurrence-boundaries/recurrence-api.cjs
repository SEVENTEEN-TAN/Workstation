/* eslint-disable @typescript-eslint/no-require-imports -- Standalone isolated integration evidence. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..'), runId = crypto.randomUUID();
const temp = path.join(os.tmpdir(), 'workstation-recurrence-boundaries-' + runId), output = path.join(__dirname, 'run-' + runId);
const port = 3017, base = 'http://127.0.0.1:' + port;
const results = { runId, startedAt: new Date().toISOString(), assertions: [], api: [], records: {} };
const freePort = () => new Promise((resolve) => { const s = net.createServer(); s.once('error', () => resolve(false)); s.listen(port, '127.0.0.1', () => s.close(() => resolve(true))); });
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
let db, server, token;
async function check(name, work) { try { await work(); results.assertions.push({ name, pass: true }); } catch (e) { results.assertions.push({ name, pass: false, error: e.message }); } }
async function request(endpoint, data) {
  const response = await fetch(base + endpoint, { method: 'PATCH', headers: { cookie: 'workstation_session=' + token, 'content-type': 'application/json' }, body: JSON.stringify(data) });
  const body = await response.json(); results.api.push({ endpoint, status: response.status, body }); return { status: response.status, body };
}
async function main() {
  await fs.mkdir(output, { recursive: true }); assert.equal(await freePort(), true, 'Port occupied; no unowned process is stopped');
  await fs.mkdir(temp); await fs.writeFile(path.join(temp, 'owner.json'), JSON.stringify({ runId, purpose: 'recurrence-boundaries' }));
  await fs.copyFile(process.env.SOURCE_DB || 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db', path.join(temp, 'test.db'));
  const { PrismaClient } = createRequire(path.join(root, 'package.json'))('@prisma/client');
  const databaseURL = 'file:' + path.join(temp, 'test.db').replaceAll('\\', '/'); db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
  try {
    results.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
    results.buildId = (await fs.readFile(path.join(root, '.next/BUILD_ID'), 'utf8')).trim();
    results.sourceHashes = {};
    for (const file of ['src/lib/services/okr.ts', 'src/lib/okr/recurrence.ts', 'src/lib/validators/okr.ts', 'prisma/schema.prisma', 'src/app/api/admin/okr/action-items/[id]/route.ts']) results.sourceHashes[file] = sha(await fs.readFile(path.join(root, file)));
    const user = await db.user.create({ data: { username: 'recurrence-' + runId, passwordHash: 'unused-isolated-session' } });
    token = crypto.randomBytes(32).toString('base64url'); await db.session.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 3600000) } });
    const cycle = await db.okrCycle.create({ data: { nameZh: '边界验收', type: 'CUSTOM', status: 'ACTIVE', startDate: new Date('2026-09-01'), endDate: new Date('2026-12-31') } });
    const objective = await db.objective.create({ data: { cycleId: cycle.id, titleZh: '边界目标', status: 'IN_PROGRESS' } });
    const kr = await db.keyResult.create({ data: { objectiveId: objective.id, titleZh: '不随行动自动变更', progressMode: 'MANUAL', manualProgress: 35, status: 'IN_PROGRESS' } });
    await db.krProgressUpdate.create({ data: { keyResultId: kr.id, manualProgress: 35, calculatedProgress: 35, noteZh: '原始进度历史' } });
    const krBefore = await db.keyResult.findUniqueOrThrow({ where: { id: kr.id }, include: { progressUpdates: true } });
    const makeAction = (title, extra = {}) => db.actionItem.create({ data: { keyResultId: kr.id, titleZh: title, titleEn: 'Boundary action', recurrenceType: 'WEEKLY', recurrenceInterval: 2, recurrenceDays: '1,4', dueDate: new Date('2026-09-21'), sortOrder: 7, ...extra } });
    server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], { cwd: root, env: { ...process.env, DATABASE_URL: databaseURL }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('server-startup-timeout')), 15000); server.once('error', (e) => { clearTimeout(timer); reject(e); }); server.once('exit', (code) => { clearTimeout(timer); reject(new Error('server-exited-' + code)); }); server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Ready')) { clearTimeout(timer); resolve(); } }); });
    server.stderr.on('data', () => {});
    const weekly = await makeAction('三代双周行动'); let parent = weekly;
    for (const [generation, expected] of [[1, '2026-09-24T00:00:00.000Z'], [2, '2026-10-05T00:00:00.000Z'], [3, '2026-10-08T00:00:00.000Z']]) {
      await check('generation-' + generation + ':hand-calculated-weekday-and-inheritance', async () => {
        assert.equal((await request('/api/admin/okr/action-items/' + parent.id, { status: 'DONE' })).status, 200);
        const saved = await db.actionItem.findUniqueOrThrow({ where: { id: parent.id } });
        const children = await db.actionItem.findMany({ where: { generatedFromActionItemId: parent.id } }); assert.equal(children.length, 1);
        const child = children[0]; assert.equal(child.dueDate.toISOString(), expected);
        for (const key of ['keyResultId','titleZh','titleEn','sortOrder','recurrenceType','recurrenceInterval','recurrenceDays']) assert.deepEqual(child[key], parent[key]);
        assert.equal(child.status, 'TODO'); assert.equal(child.completedAt, null); assert.equal(child.hasGeneratedNext, false);
        assert.equal(saved.status, 'DONE'); assert.equal(saved.hasGeneratedNext, true); assert.ok(saved.completedAt); assert.deepEqual(saved.dueDate, parent.dueDate);
        results.records['generation-' + generation] = { original: saved, child, expected }; parent = child;
      });
    }
    const concurrent = await makeAction('八个并发完成请求');
    await check('eight-concurrent-completions-return-success-and-exactly-one-child', async () => {
      const responses = await Promise.all(Array.from({ length: 8 }, () => request('/api/admin/okr/action-items/' + concurrent.id, { status: 'DONE' })));
      results.concurrentStatuses = responses.map((r) => r.status);
      const original = await db.actionItem.findUniqueOrThrow({ where: { id: concurrent.id } });
      const children = await db.actionItem.findMany({ where: { generatedFromActionItemId: concurrent.id } }); results.records.concurrent = { original, children };
      assert.equal(children.length, 1); assert.equal(children[0].dueDate.toISOString(), '2026-09-24T00:00:00.000Z');
      assert.equal(original.hasGeneratedNext, true); assert.equal(original.status, 'DONE');
      assert.deepEqual(responses.map((r) => r.status), Array(8).fill(200));
      for (const response of responses) assert.equal(response.body.completedAt, original.completedAt.toISOString());
    });
    const undated = await makeAction('无截止日期实际完成', { dueDate: null, recurrenceType: 'DAILY', recurrenceInterval: 2, recurrenceDays: null });
    await check('undated-action-uses-persisted-shanghai-completion-calendar', async () => {
      assert.equal((await request('/api/admin/okr/action-items/' + undated.id, { status: 'DONE' })).status, 200);
      const saved = await db.actionItem.findUniqueOrThrow({ where: { id: undated.id } }), child = await db.actionItem.findUniqueOrThrow({ where: { generatedFromActionItemId: undated.id } });
      const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(saved.completedAt);
      const expected = new Date(date + 'T00:00:00.000Z'); expected.setUTCDate(expected.getUTCDate() + 2);
      assert.equal(child.dueDate.toISOString(), expected.toISOString()); assert.equal(saved.dueDate, null);
      results.records.undated = { original: saved, child, expected: expected.toISOString(), injectedClock: false };
    });
    const rollback = await makeAction('派生失败回滚后重试');
    await check('real-database-insert-failure-rolls-back-completion-then-retry-succeeds', async () => {
      await db.$executeRawUnsafe("CREATE TRIGGER evidence_reject_successor BEFORE INSERT ON action_items WHEN NEW.generated_from_action_item_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'isolated evidence insertion failure'); END;");
      let response;
      try { response = await request('/api/admin/okr/action-items/' + rollback.id, { status: 'DONE' }); }
      finally { await db.$executeRawUnsafe('DROP TRIGGER evidence_reject_successor;'); }
      assert.ok(response.status >= 400); const failed = await db.actionItem.findUniqueOrThrow({ where: { id: rollback.id } });
      assert.equal(failed.status, 'TODO'); assert.equal(failed.hasGeneratedNext, false); assert.equal(failed.completedAt, null);
      assert.equal(await db.actionItem.count({ where: { generatedFromActionItemId: rollback.id } }), 0);
      assert.equal((await request('/api/admin/okr/action-items/' + rollback.id, { status: 'DONE' })).status, 200);
      assert.equal(await db.actionItem.count({ where: { generatedFromActionItemId: rollback.id } }), 1);
      results.records.rollback = { failedResponseStatus: response.status, afterFailure: failed, afterRetry: await db.actionItem.findUniqueOrThrow({ where: { id: rollback.id } }) };
    });
    await check('all-generations-concurrency-and-rollback-preserve-kr-and-progress-history', async () => {
      const after = await db.keyResult.findUniqueOrThrow({ where: { id: kr.id }, include: { progressUpdates: true } }); assert.deepEqual(after, krBefore); results.records.kr = { before: krBefore, after };
    });
    results.completed = true; results.passed = results.assertions.every((a) => a.pass); process.exitCode = results.passed ? 0 : 1;
  } catch (e) { results.infrastructureError = { message: e.message, stack: e.stack }; process.exitCode = 2; }
  finally {
    if (db) await db.$disconnect(); if (server && server.exitCode === null && server.signalCode === null) { const exited = new Promise((resolve) => server.once('exit', resolve)); server.kill(); await exited; }
    const target = await fs.realpath(temp), tempRoot = await fs.realpath(os.tmpdir()); assert.equal(path.dirname(target).toLowerCase(), tempRoot.toLowerCase()); assert.equal(path.basename(target), 'workstation-recurrence-boundaries-' + runId);
    const owner = JSON.parse(await fs.readFile(path.join(target, 'owner.json'), 'utf8')); assert.equal(owner.runId, runId); assert.equal(owner.purpose, 'recurrence-boundaries'); await fs.rm(target, { recursive: true });
    results.cleanup = { databaseDisconnected: true, ownedServerExited: !server || server.exitCode !== null || server.signalCode !== null, port3017Free: await freePort(), ownedTempDeleted: await fs.stat(target).then(() => false, () => true) };
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n'); console.log(JSON.stringify({ output, assertions: results.assertions, infrastructureError: results.infrastructureError?.message, cleanup: results.cleanup }, null, 2));
  }
}
main().catch((e) => { console.error(e.message); process.exitCode = 2; });
