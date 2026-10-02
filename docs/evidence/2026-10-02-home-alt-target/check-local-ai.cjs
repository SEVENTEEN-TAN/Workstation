/* eslint-disable @typescript-eslint/no-require-imports -- Secret-safe local readiness audit. */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = 'C:/Users/23399/Desktop/sqtan/WorkStation';
const envFile = path.join(root, '.env');
const result = { scope: 'primary local checkout only, no production connection or model request', envFilePresent: fs.existsSync(envFile) };
if (result.envFilePresent) {
  delete process.env.DATABASE_URL;
  process.loadEnvFile(envFile);
}
const url = process.env.DATABASE_URL || '';
result.localSqliteConfigured = url.startsWith('file:');
if (result.localSqliteConfigured) {
  const raw = url.slice(5).split('?')[0];
  const dbFile = path.isAbsolute(raw) ? raw : path.resolve(root, 'prisma', raw);
  result.databaseFilePresent = fs.existsSync(dbFile);
  if (result.databaseFilePresent) {
    const db = new DatabaseSync(dbFile, { readOnly: true });
    try {
      const setting = db.prepare(`SELECT p.enabled, p.last_test_status, p.credential_env_var, p.auth_type, s.model
        FROM ai_use_case_settings s JOIN ai_providers p ON p.id = s.provider_id
        WHERE s.use_case = ?`).get('WEEKLY_UPDATE');
      result.weeklySettingPresent = !!setting;
      if (setting) {
        result.providerEnabled = !!setting.enabled;
        result.providerTestSuccessful = setting.last_test_status === 'SUCCESS';
        result.modelPresent = !!setting.model;
        result.credentialConfigured = setting.auth_type === 'NONE' || !!(setting.credential_env_var && process.env[setting.credential_env_var]);
        result.ready = result.providerEnabled && result.providerTestSuccessful && result.modelPresent && result.credentialConfigured;
      } else result.ready = false;
    } finally { db.close(); }
  }
}
fs.writeFileSync(path.join(__dirname, 'local-ai-readiness.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
