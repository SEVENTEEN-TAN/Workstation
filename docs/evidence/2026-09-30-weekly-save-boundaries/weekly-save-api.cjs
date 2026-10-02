/* eslint-disable @typescript-eslint/no-require-imports -- Standalone isolated integration evidence. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const http = require('node:http');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../../..');
const runId = crypto.randomUUID();
const purpose = 'weekly-save-boundaries';
const temp = path.join(os.tmpdir(), 'workstation-' + purpose + '-' + runId);
const output = path.join(__dirname, 'run-' + runId);
const sourceDatabase = process.env.SOURCE_DB || 'C:/Users/23399/AppData/Local/Temp/workstation-f4-build-f8549459847043a980a0e66f43f27e81.db';
const expectedHead = process.env.EXPECTED_HEAD || 'db4684132f50f43105cbac251cff23d87f8d1928';
const port = 3020;
const keys = ['titleZh', 'titleEn', 'summaryZh', 'summaryEn'];
const sourceFiles = ['src/lib/services/weekly-activity-drafts.ts', 'src/lib/validators/weekly-activity-drafts.ts', 'src/app/api/admin/weekly/[id]/route.ts', 'src/lib/services/http.ts', 'prisma/schema.prisma'];
const results = { runId, purpose, port, startedAt: new Date().toISOString(), assertions: [], requests: [], bursts: [], rollback: {}, cleanup: {} };
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const copyOf = (value) => Object.fromEntries(keys.map((key) => [key, value[key]]));
let db, server, token, tempCreated = false;
let serverLog = '';
const freePort = () => new Promise((resolve) => {
  const socket = net.createServer();
  socket.once('error', () => resolve(false));
  socket.listen(port, '127.0.0.1', () => socket.close(() => resolve(true)));
});
async function check(name, work) {
  try { await work(); results.assertions.push({ name, pass: true }); }
  catch (error) { results.assertions.push({ name, pass: false, error: error.message }); }
}
function request(label, id, payload) {
  const record = { label, endpoint: '/api/admin/weekly/' + id, method: 'PATCH', payload, dispatchedAt: new Date().toISOString(), dispatchedMs: performance.now() };
  results.requests.push(record);
  return new Promise((resolve, reject) => {
    const call = http.request({ hostname: '127.0.0.1', port, path: record.endpoint, method: 'PATCH', agent: false,
      headers: { cookie: 'workstation_session=' + token, 'content-type': 'application/json' } }, (response) => {
      record.responseStartedMs = performance.now();
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        record.status = response.statusCode;
        record.finishedAt = new Date().toISOString();
        record.finishedMs = performance.now();
        try { record.body = JSON.parse(body); } catch { record.body = body; }
        resolve(record);
      });
      response.on('error', reject);
    });
    call.once('socket', (socket) => socket.once('connect', () => { record.socketConnectedMs = performance.now(); }));
    call.once('finish', () => { record.sentMs = performance.now(); });
    call.once('error', (error) => { record.transportError = error.message; reject(error); });
    call.setTimeout(30000, () => call.destroy(new Error('request timeout')));
    call.end(JSON.stringify(payload));
  });
}
async function fixture(index) {
  // Fixed old versions avoid wall-clock equality, and unique dates avoid existing fixture collisions.
  let weekStart = new Date(Date.UTC(2080, 0, index + 1));
  while (await db.weeklyActivityDraft.findUnique({ where: { weekStart } })) weekStart = new Date(weekStart.getTime() + 86400000);
  return db.weeklyActivityDraft.create({ data: {
    weekStart, weekEnd: new Date(weekStart.getTime() + 6 * 86400000), status: 'DRAFT',
    titleZh: '初始中文标题-' + index, titleEn: 'Initial English title ' + index,
    summaryZh: '初始中文摘要-' + index, summaryEn: 'Initial English summary ' + index,
    sourceSnapshot: { github: [], progress: [], actions: [], projects: [], articles: [], activities: [] },
    updatedAt: new Date('2001-01-01T00:00:00.000Z'),
  } });
}
const payload = (label, version) => ({ titleZh: '中文标题-' + label, titleEn: 'English title ' + label,
  summaryZh: '中文摘要-' + label, summaryEn: 'English summary ' + label, expectedUpdatedAt: version });
const snapshot = (id) => db.weeklyActivityDraft.findUniqueOrThrow({ where: { id } });
async function concurrentBurst(index) {
  const before = await fixture(index);
  const bodies = ['A', 'B'].map((side) => payload('burst-' + index + '-' + side, before.updatedAt.toISOString()));
  // Separate sockets, launched in the same turn without awaiting either PATCH.
  const responses = await Promise.all(bodies.map((body, side) => request('burst-' + index + '-' + side, before.id, body)));
  const after = await snapshot(before.id);
  const burst = { index, before, after, statuses: responses.map((r) => r.status), requestLabels: responses.map((r) => r.label),
    requestIntervalsOverlap: Math.max(...responses.map((r) => r.dispatchedMs)) < Math.min(...responses.map((r) => r.finishedMs)),
    socketsSentBeforeFirstResponse: Math.max(...responses.map((r) => r.sentMs)) < Math.min(...responses.map((r) => r.responseStartedMs)) };
  results.bursts.push(burst);
  await check('burst-' + index + ':two-PATCH-overlap-and-both-sent-before-first-response', () => {
    assert.equal(burst.requestIntervalsOverlap, true); assert.equal(burst.socketsSentBeforeFirstResponse, true);
  });
  await check('burst-' + index + ':exactly-one-200-and-one-409', () => assert.deepEqual([...burst.statuses].sort(), [200, 409]));
  const successful = responses.filter((response) => response.status === 200);
  await check('burst-' + index + ':stored-four-fields-and-version-match-sole-winner', () => {
    assert.equal(successful.length, 1);
    assert.deepEqual(copyOf(after), copyOf(successful[0].payload));
    assert.equal(after.updatedAt.toISOString(), successful[0].body.updatedAt);
    assert.notEqual(after.updatedAt.toISOString(), before.updatedAt.toISOString());
  });
  const loser = responses.find((response) => response.status !== 200) || responses[1];
  burst.staleRetry = await request('burst-' + index + '-loser-stale-retry', before.id, loser.payload);
  burst.afterStaleRetry = await snapshot(before.id);
  await check('burst-' + index + ':stale-loser-retry-409-with-no-overwrite', () => {
    assert.equal(burst.staleRetry.status, 409); assert.deepEqual(burst.afterStaleRetry, after);
  });
  burst.freshRetry = await request('burst-' + index + '-loser-fresh-retry', before.id, { ...loser.payload, expectedUpdatedAt: after.updatedAt.toISOString() });
  burst.afterFreshRetry = await snapshot(before.id);
  await check('burst-' + index + ':fresh-version-retry-200-with-complete-four-fields', () => {
    assert.equal(burst.freshRetry.status, 200); assert.deepEqual(copyOf(burst.afterFreshRetry), copyOf(loser.payload));
    assert.equal(burst.afterFreshRetry.updatedAt.toISOString(), burst.freshRetry.body.updatedAt);
    assert.notEqual(burst.afterFreshRetry.updatedAt.toISOString(), after.updatedAt.toISOString());
  });
}
async function rollback() {
  const before = await fixture(20);
  results.rollback.before = before;
  const trigger = 'evidence_weekly_reject_update';
  await db.$executeRawUnsafe("CREATE TRIGGER " + trigger + " BEFORE UPDATE ON weekly_activity_drafts WHEN OLD.id = '" + before.id + "' BEGIN SELECT RAISE(ABORT, 'isolated evidence weekly update failure'); END;");
  try { results.rollback.failedRequest = await request('rollback-trigger-failure', before.id, payload('rollback', before.updatedAt.toISOString())); }
  finally { await db.$executeRawUnsafe('DROP TRIGGER ' + trigger + ';'); results.rollback.triggerDropped = true; }
  results.rollback.afterFailure = await snapshot(before.id);
  await check('real-SQLite-BEFORE-UPDATE-failure-preserves-all-data-and-version', () => {
    assert.ok(results.rollback.failedRequest.status >= 400); assert.deepEqual(results.rollback.afterFailure, before);
  });
  results.rollback.retry = await request('rollback-after-trigger-drop-retry', before.id, payload('rollback', before.updatedAt.toISOString()));
  results.rollback.afterRetry = await snapshot(before.id);
  await check('trigger-dropped-and-original-version-retry-200', () => {
    assert.equal(results.rollback.triggerDropped, true); assert.equal(results.rollback.retry.status, 200);
    assert.deepEqual(copyOf(results.rollback.afterRetry), copyOf(results.rollback.retry.payload));
    assert.notEqual(results.rollback.afterRetry.updatedAt.toISOString(), before.updatedAt.toISOString());
  });
}
async function main() {
  await fs.mkdir(output, { recursive: true });
  try {
    results.portFreeBefore = await freePort();
    assert.equal(results.portFreeBefore, true, 'Port occupied; no unowned process is stopped');
    results.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
    assert.equal(results.head, expectedHead);
    results.buildId = (await fs.readFile(path.join(root, '.next/BUILD_ID'), 'utf8')).trim();
    results.sourceHashes = {};
    for (const file of sourceFiles) results.sourceHashes[file] = sha(await fs.readFile(path.join(root, file)));
    const routeBundle = '.next/server/app/api/admin/weekly/[id]/route.js';
    results.builtRoute = { path: routeBundle, sha256: sha(await fs.readFile(path.join(root, routeBundle))) };
    await fs.mkdir(temp); tempCreated = true;
    await fs.writeFile(path.join(temp, 'owner.json'), JSON.stringify({ runId, purpose }));
    await fs.copyFile(sourceDatabase, path.join(temp, 'test.db'));
    const { PrismaClient } = createRequire(path.join(root, 'package.json'))('@prisma/client');
    const databaseURL = 'file:' + path.join(temp, 'test.db').replaceAll('\\', '/');
    db = new PrismaClient({ datasources: { db: { url: databaseURL } } });
    const user = await db.user.create({ data: { username: 'weekly-evidence-' + runId, passwordHash: 'unused-isolated-session' } });
    token = crypto.randomBytes(32).toString('base64url');
    await db.session.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + 3600000) } });
    results.authentication = { isolatedUserCreated: true, randomTokenStoredHashed: true, tokenRecorded: false };
    server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(port), '-H', '127.0.0.1'], {
      cwd: root, env: { ...process.env, DATABASE_URL: databaseURL }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    results.ownedServerPid = server.pid;
    server.stdout.on('data', (chunk) => { serverLog += chunk.toString(); });
    server.stderr.on('data', (chunk) => { serverLog += chunk.toString(); });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('server-startup-timeout')), 15000);
      server.once('error', (error) => { clearTimeout(timer); reject(error); });
      server.once('exit', (code) => { clearTimeout(timer); reject(new Error('server-exited-' + code)); });
      server.stdout.on('data', (chunk) => { if (chunk.toString().includes('Ready')) { clearTimeout(timer); resolve(); } });
    });
    for (const index of [1, 2, 3]) await concurrentBurst(index);
    await rollback();
    await check('source-head-and-built-route-remained-unchanged-during-run', async () => {
      assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(), results.head);
      assert.equal((await fs.readFile(path.join(root, '.next/BUILD_ID'), 'utf8')).trim(), results.buildId);
      assert.equal(sha(await fs.readFile(path.join(root, routeBundle))), results.builtRoute.sha256);
      for (const file of sourceFiles) assert.equal(sha(await fs.readFile(path.join(root, file))), results.sourceHashes[file]);
    });
    results.completed = true;
  } catch (error) { results.infrastructureError = { message: error.message, stack: error.stack }; }
  finally {
    try {
      if (db) { await db.$disconnect(); results.cleanup.databaseDisconnected = true; }
      if (server && server.exitCode === null && server.signalCode === null) {
        const exited = new Promise((resolve) => server.once('exit', resolve)); server.kill(); await exited;
      }
      results.cleanup.ownedServerExited = !server || server.exitCode !== null || server.signalCode !== null;
      if (tempCreated) {
        const target = await fs.realpath(temp), tempRoot = await fs.realpath(os.tmpdir());
        assert.equal(path.dirname(target).toLowerCase(), tempRoot.toLowerCase());
        assert.equal(path.basename(target), 'workstation-' + purpose + '-' + runId);
        assert.deepEqual(JSON.parse(await fs.readFile(path.join(target, 'owner.json'), 'utf8')), { runId, purpose });
        results.cleanup.realpathExactUuidAndOwnerVerified = true;
        await fs.rm(target, { recursive: true });
        results.cleanup.ownedTempDeleted = await fs.stat(target).then(() => false, () => true);
      }
      results.cleanup.port3020Free = await freePort();
    } catch (error) { results.cleanup.error = error.message; }
    results.finishedAt = new Date().toISOString();
    results.passed = !!results.completed && results.assertions.every((entry) => entry.pass) && !results.cleanup.error;
    // Headers/session token are deliberately never recorded. All requests target new isolated fixtures.
    if (token) serverLog = serverLog.replaceAll(token, '[REDACTED]');
    await fs.writeFile(path.join(output, 'server.log'), serverLog);
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(JSON.stringify({ output, passed: results.passed, statuses: results.bursts.map((burst) => burst.statuses),
      failedAssertions: results.assertions.filter((entry) => !entry.pass), rollbackStatus: results.rollback.failedRequest?.status,
      infrastructureError: results.infrastructureError?.message, cleanup: results.cleanup }, null, 2));
    process.exitCode = results.infrastructureError || results.cleanup.error ? 2 : results.passed ? 0 : 1;
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 2; });
