import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [environment, source] = process.argv.slice(2);
assert.ok(environment === 'pre-production' || environment === 'production', 'Unknown release environment');
assert.match(source ?? '', /^[a-f0-9]{40}$/, 'Missing checked source');
const project = environment === 'pre-production' ? 'finbuddy-preprod' : 'finbuddy-2025';
const prefix = environment === 'pre-production' ? 'preprod' : 'production';
const gcloud = process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
function command(program: string, args: string[], capture = false): string {
  const result = spawnSync(program, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error(`Release command failed: ${program} ${args.slice(0, 3).join(' ')} (exit ${result.status})`);
  return capture ? result.stdout.trim() : '';
}
async function hostingVersion(): Promise<unknown> {
  const token = command(gcloud, ['auth', 'print-access-token'], true);
  const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${project}/releases?pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000), redirect: 'error',
  });
  assert.equal(response.status, 200, 'Hosting recovery metadata unavailable');
  const body = await response.json() as { releases?: Array<{ name: string; releaseTime: string; version: { name: string } }> };
  return body.releases?.map(row => ({ name: row.name, time: row.releaseTime, version: row.version?.name })) ?? [];
}
function backendVersion(name: string): unknown {
  const result = spawnSync(gcloud, ['functions', 'describe', name, '--gen2', '--region=asia-south1', `--project=${project}`, '--format=json'],
    { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0) return { name, absent: true };
  const row = JSON.parse(result.stdout) as { serviceConfig: { revision: string; serviceAccountEmail: string; environmentVariables?: Record<string, string> } };
  return { name, revision: row.serviceConfig.revision, identity: row.serviceConfig.serviceAccountEmail,
    source: row.serviceConfig.environmentVariables?.FINBUDDY_BUILD_COMMIT ?? null };
}
await mkdir('verification', { recursive: true });
const before = { project, at: new Date().toISOString(), hosting: await hostingVersion(),
  backend: ['finbuddyApi', 'finbuddyExpenseAudit'].map(backendVersion) };
await writeFile(`verification/${prefix}-before.json`, JSON.stringify(before, null, 2));
assert.equal(command(gcloud, ['secrets', 'versions', 'describe', 'latest', '--secret=FINBUDDY_DT_INGEST_AUTHORIZATION',
  `--project=${project}`, '--format=value(state)'], true), 'ENABLED', 'Missing enabled environment-specific ingest secret');
await writeFile(`api/.env.${project}`, [
  'OTEL_EXPORTER_OTLP_ENDPOINT=https://indiacs.live.dynatrace.com/api/v2/otlp',
  'FINBUDDY_ENABLE_BACKEND_TELEMETRY=true', `FINBUDDY_BUILD_COMMIT=${source}`, '',
].join('\n'), { mode: 0o600 });
command(npx, ['--yes', 'firebase-tools@14.27.0', 'deploy', '--non-interactive', '--project', project,
  '--config', 'firebase.api.json', '--only', 'functions:finbuddy-api']);

// These generated artifacts are in this checkout; never follow an external dist symlink.
const workspace = await realpath('.');
const target = resolve('dist');
assert.equal(dirname(target), workspace);
try { assert.equal(await realpath(target), target); }
catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; }
await rm(target, { recursive: true, force: true });
await cp(`release/${prefix}`, target, { recursive: true, dereference: false });
command(npx, ['--yes', 'firebase-tools@14.20.0', 'deploy', '--non-interactive', '--project', project,
  '--config', environment === 'pre-production' ? 'firebase.preprod.json' : 'firebase.json', '--only', 'hosting']);
const after = { project, source, at: new Date().toISOString(), hosting: await hostingVersion(),
  backend: ['finbuddyApi', 'finbuddyExpenseAudit'].map(backendVersion),
  candidate: JSON.parse(await readFile('release/receipt.json', 'utf8')) as unknown };
await writeFile(`verification/${prefix}-deployed.json`, JSON.stringify(after, null, 2));
process.stdout.write(`Deployed checked ${environment} source ${source}; provider identities recorded.\n`);
