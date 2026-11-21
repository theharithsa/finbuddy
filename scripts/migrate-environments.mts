import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { dataEnvironment } from '../api/shared/environment.ts';
import { copyPlan, fieldsDigest, snapshot, verifyPlan, retireLegacy, restoreLegacy, type RetirementProgress, type CopyPlan, type CopyProgress, type Json, type ProviderRequest } from './firestore-copy.mts';

const options = new Map(process.argv.slice(2).map(argument => {
  const split = argument.indexOf('=');
  assert.ok(argument.startsWith('--') && split > 2, 'Use --option=value');
  return [argument.slice(2, split), argument.slice(split + 1)];
}));
const mode = options.get('mode');
assert.ok(mode === 'snapshot' || mode === 'copy' || mode === 'verify' || mode === 'retire-legacy' || mode === 'restore-legacy', 'Choose a supported migration mode');
const project = options.get('project');
assert.ok(project === 'finbuddy-2025' || project === 'demo-finbuddy');
const environment = dataEnvironment(options.get('environment'));
assert.ok(project === 'demo-finbuddy' || environment === 'prod',
  'Existing production households must never be copied into preprod');
const manifest = options.get('manifest');
assert.ok(manifest && isAbsolute(manifest), 'Choose an absolute private manifest path');
const workspace = await realpath('.');
const parent = await realpath(dirname(manifest));
assert.ok(relative(workspace, parent).startsWith('..'), 'Manifests must stay outside the repository');
const emulator = project === 'demo-finbuddy';
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (emulator) assert.match(host ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
const origin = emulator ? `http://${host}/v1/` : 'https://firestore.googleapis.com/v1/';
const admin = createRequire(resolve('api/package.json'))('firebase-admin/app') as {
  applicationDefault(): { getAccessToken(): Promise<{ access_token: string }> };
};
const credential = emulator ? undefined : admin.applicationDefault();
const request: ProviderRequest = async <T,>(path: string, method = 'GET', body?: unknown): Promise<T> => {
  assert.ok(path.startsWith(`projects/${project}/databases/(default)/documents`), 'Unexpected provider resource');
  const token = credential ? (await credential.getAccessToken()).access_token : undefined;
  const response = await fetch(new URL(path, origin), {
    method, headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}`, 'X-Goog-User-Project': project } : { Authorization: 'Bearer owner' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(45_000), redirect: 'error',
  });
  if (response.status === 404 && method === 'GET') return null as T;
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Migration provider request returned ${response.status}`); }
  return await response.json() as T;
};
const progressPath = options.get('progress') ?? manifest + '.progress.json';
assert.ok(isAbsolute(progressPath) && relative(workspace, await realpath(dirname(progressPath))).startsWith('..'),
  'Progress must stay in the private migration workspace');
try {
  if (mode === 'snapshot') {
    const plan = await snapshot(request, project, environment);
    if (options.has('receipt-map')) {
      const mapping = JSON.parse(await readFile(options.get('receipt-map')!, 'utf8')) as Record<string, string>;
      for (const entry of plan.entries) {
        if (!/\/users\/[^/]+\/expenses\/[^/]+$/.test(entry.source.name)) continue;
        const field = entry.fields.receiptUrl;
        if (field && !Array.isArray(field) && typeof field === 'object' && typeof field.stringValue === 'string') {
          const replacement = mapping[field.stringValue];
          if (replacement) {
            field.stringValue = replacement;
            entry.digest = fieldsDigest(entry.fields as Record<string, Json>);
          }
        }
      }
    }
    await writeFile(manifest, JSON.stringify(plan), { flag: 'wx', mode: 0o600 });
    process.stdout.write(`Read-only snapshot: ${plan.entries.length} documents. Original documents unchanged.\n`);
  } else {
    assert.equal(options.get('ack-project'), project, 'Explicit project acknowledgement required');
    const bytes = await readFile(manifest);
    const plan = JSON.parse(bytes.toString('utf8')) as CopyPlan;
    assert.equal(plan.project, project); assert.equal(plan.environment, environment);
    if (mode === 'copy') {
      let progress: CopyProgress = { schemaVersion: 1, targets: {} };
      try { progress = JSON.parse(await readFile(progressPath, 'utf8')) as CopyProgress; }
      catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error; }
      const result = await copyPlan(request, plan, progress,
        () => writeFile(progressPath, JSON.stringify(progress), { mode: 0o600 }));
      process.stdout.write(`Copy readback: ${result.copied} copied, ${result.unchanged} already matching; originals retained.\n`);
    } else if (mode === 'verify') {
      const verified = await verifyPlan(request, plan);
      process.stdout.write(`Verified ${verified} documents and the unchanged source set; no customer-data deletion performed.\n`);
    } else {
      assert.equal(options.get('backup-sha256'), createHash('sha256').update(bytes).digest('hex'), 'Read-back verified backup digest required');
      assert.equal(options.get('backup-verified'), 'true');
      if (mode === 'retire-legacy') {
        assert.equal(options.get('cutover-verified'), 'true', 'Verified production cutover required before legacy retirement');
        const retirementPath = manifest + '.retired.json';
        let progress: RetirementProgress = { schemaVersion: 1, retired: {} };
        try { progress = JSON.parse(await readFile(retirementPath, 'utf8')) as RetirementProgress; }
        catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error; }
        const retired = await retireLegacy(request, plan, progress,
          () => writeFile(retirementPath, JSON.stringify(progress), { mode: 0o600 }));
        process.stdout.write(`Retired ${retired} unchanged legacy copies; production namespaces and FinVision preserved.\n`);
      } else {
        assert.equal(options.get('recovery-reviewed'), 'true', 'Review schema and receipt capabilities before restoring legacy data');
        const restored = await restoreLegacy(request, plan);
        process.stdout.write(`Recovery readback: ${restored} legacy records restored with original typed fields; existing records preserved.\n`);
      }
    }
  }
} catch (error) {
  await writeFile(manifest + '.failure.txt', error instanceof Error ? error.stack ?? error.message : 'Unknown migration failure', { mode: 0o600 });
  process.stderr.write('Migration stopped. Details are retained beside the private manifest; cutover is blocked.\n');
  process.exitCode = 1;
}
