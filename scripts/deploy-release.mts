import { dataRoot, deploymentTargets, firebaseProject } from '../api/shared/environment.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const [environment, source] = process.argv.slice(2);
assert.ok(environment === 'pre-production' || environment === 'production', 'Unknown release environment');
assert.match(source ?? '', /^[a-f0-9]{40}$/, 'Missing checked source');
const project = firebaseProject;
const namespace = environment === 'pre-production' ? 'preprod' : 'prod';
const targetConfig = deploymentTargets[namespace];
const prefix = environment === 'pre-production' ? 'preprod' : 'production';
const gcloud = process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
function command(program: string, args: string[], capture = false): string {
  const result = spawnSync(program, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error(`Release command failed: ${program} ${args.slice(0, 3).join(' ')} (exit ${result.status})`);
  return capture ? result.stdout.trim() : '';
}
if (namespace === 'prod') {
  assert.match(process.env.ACCEPTANCE_RECEIPT ?? '', /^[a-f0-9]{64}$/,
    'Production deployment requires the exact owner-accepted receipt');
  assert.equal(process.env.CANDIDATE_SHA, source);
  command(process.execPath, ['scripts/release-control.mts', 'verify']);
}
async function hostingVersion(): Promise<unknown> {
  const token = command(gcloud, ['auth', 'print-access-token'], true);
  const response = await fetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${targetConfig.site}/releases?pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000), redirect: 'error',
  });
  assert.equal(response.status, 200, 'Hosting recovery metadata unavailable');
  const body = await response.json() as { releases?: Array<{ name: string; releaseTime: string; version: { name: string } }> };
  return body.releases?.map(row => ({ name: row.name, time: row.releaseTime, version: row.version?.name })) ?? [];
}
async function dataPolicy(kind: 'storage' | 'firestore') {
  const token = command(gcloud, ['auth', 'print-access-token'], true);
  const read = async (path: string): Promise<unknown> => {
    const response = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Goog-User-Project': project },
      signal: AbortSignal.timeout(20_000), redirect: 'error',
    });
    assert.equal(response.status, 200, 'Storage policy recovery metadata unavailable');
    return response.json();
  };
  const releases = await read(`projects/${project}/releases`) as { releases?: Array<{ name: string; rulesetName: string }> };
  const expectedRelease = kind === 'storage' ? `firebase.storage/${project}.firebasestorage.app` : 'cloud.firestore';
  const release = releases.releases?.find(item => item.name === `projects/${project}/releases/${expectedRelease}`);
  assert.ok(release, 'Environment data policy is not provisioned');
  const ruleset = await read(release.rulesetName) as { source?: { files?: Array<{ name: string; content: string }> } };
  const files = ruleset.source?.files;
  assert.equal(files?.length, 1, 'Unexpected Storage policy source layout');
  assert.ok(files?.[0]);
  const digest = (code: string) => createHash('sha256').update(code.replace(/\r\n/g, '\n').trimEnd()).digest('hex');
  const deployedDigest = digest(files[0].content);
  const strictDigest = digest(await readFile(`${kind}.rules`, 'utf8'));
  const transitionDigest = digest(await readFile(`${kind}.transition.rules`, 'utf8'));
  return { release: release.name, ruleset: release.rulesetName, digest: deployedDigest,
    checkedDigest: strictDigest, transitionDigest,
    accepted: deployedDigest === strictDigest || (namespace === 'preprod' && deployedDigest === transitionDigest) };
}
const backends: Record<string, string> = { [targetConfig.api]: targetConfig.api.toLowerCase(), [targetConfig.audit]: targetConfig.audit.toLowerCase() };
type BackendName = keyof typeof backends;
type BackendSnapshot = { name: BackendName; absent: true } | {
  name: BackendName; absent: false; revision: string; identity: string; source: string | null;
  traffic: Array<{ revision: string; percent: number }>;
};
function backendVersion(name: BackendName): BackendSnapshot {
  const result = spawnSync(gcloud, ['functions', 'describe', name, '--gen2', '--region=asia-south1', `--project=${project}`, '--format=json'],
    { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    assert.match(result.stderr, /NOT_FOUND|not found/i, 'Cannot record backend recovery metadata');
    return { name, absent: true };
  }
  const row = JSON.parse(result.stdout) as { serviceConfig: { revision: string; serviceAccountEmail: string; environmentVariables?: Record<string, string> } };
  const service = JSON.parse(command(gcloud, ['run', 'services', 'describe', backends[name], '--region=asia-south1',
    `--project=${project}`, '--format=json(status.traffic)'], true)) as { status: { traffic: Array<{ revisionName: string; percent?: number }> } };
  return { name, absent: false, revision: row.serviceConfig.revision, identity: row.serviceConfig.serviceAccountEmail,
    traffic: service.status.traffic.map(target => ({ revision: target.revisionName, percent: target.percent ?? 0 })),
    source: row.serviceConfig.environmentVariables?.FINBUDDY_BUILD_COMMIT ?? null };
}
const backendNames = Object.keys(backends) as BackendName[];
await mkdir('verification', { recursive: true });
const before = { project, namespace, site: targetConfig.site, dataRoot: dataRoot(namespace), at: new Date().toISOString(), hosting: await hostingVersion(),
  backend: backendNames.map(backendVersion), storagePolicy: await dataPolicy('storage'), firestorePolicy: await dataPolicy('firestore') };
await writeFile(`verification/${prefix}-before.json`, JSON.stringify(before, null, 2));
assert.equal(before.storagePolicy.accepted, true,
  'Deploy the reviewed receipt-policy prerequisite before the application release');
assert.equal(before.firestorePolicy.accepted, true,
  'Deploy the reviewed Firestore policy prerequisite before the application release');
assert.equal(command(gcloud, ['secrets', 'versions', 'describe', 'latest', '--secret=' + targetConfig.secret,
  `--project=${project}`, '--format=value(state)'], true), 'ENABLED', 'Missing enabled environment-specific ingest secret');
await writeFile(`api/.env.${project}`, [
  'OTEL_EXPORTER_OTLP_ENDPOINT=https://indiacs.live.dynatrace.com/api/v2/otlp',
  'FINBUDDY_ENABLE_BACKEND_TELEMETRY=true', `FINBUDDY_ENVIRONMENT=${namespace}`, `FINBUDDY_BUILD_COMMIT=${source}`, '',
].join('\n'), { mode: 0o600 });
command(npx, ['--yes', 'firebase-tools@15.37.0', 'deploy', '--non-interactive', '--project', project,
  '--config', namespace === 'preprod' ? 'firebase.preprod.json' : 'firebase.api.json', '--only', `functions:${targetConfig.codebase}`]);

// A prior rollback pins Cloud Run traffic across later Functions deployments.
// Select the checked deployed revision explicitly, then verify the actual serving allocation.
for (const name of backendNames) {
  const deployed = backendVersion(name);
  assert.equal(deployed.absent, false, 'Checked backend was not deployed');
  if (deployed.absent) throw new Error('Checked backend is absent');
  assert.equal(deployed.source, source, 'Backend source does not match the candidate');
  assert.equal(deployed.identity, `${targetConfig.runtime}@${project}.iam.gserviceaccount.com`);
  assert.match(deployed.revision, new RegExp(`^${backends[name]}-[0-9]{5}-[a-z0-9]+$`));
  command(gcloud, ['run', 'services', 'update-traffic', backends[name], `--to-revisions=${deployed.revision}=100`,
    '--region=asia-south1', `--project=${project}`, '--quiet']);
  const serving = backendVersion(name);
  assert.equal(serving.absent, false);
  if (serving.absent) throw new Error('Serving backend is absent');
  assert.deepEqual(serving.traffic.filter(target => target.percent > 0), [{ revision: deployed.revision, percent: 100 }],
    'Checked backend is not serving all traffic');
}

// Select exactly one Hosting target; never deploy both environments implicitly.
command(npx, ['--yes', 'firebase-tools@15.37.0', 'deploy', '--non-interactive', '--project', project,
  '--config', 'firebase.json', '--only', `hosting:${namespace}`]);
const after = { project, namespace, site: targetConfig.site, dataRoot: dataRoot(namespace), source, at: new Date().toISOString(), hosting: await hostingVersion(),
  backend: backendNames.map(backendVersion), storagePolicy: await dataPolicy('storage'), firestorePolicy: await dataPolicy('firestore'),
  candidate: JSON.parse(await readFile('release/receipt.json', 'utf8')) as unknown };
await writeFile(`verification/${prefix}-deployed.json`, JSON.stringify(after, null, 2));
process.stdout.write(`Deployed checked ${environment} source ${source}; provider identities recorded.\n`);
