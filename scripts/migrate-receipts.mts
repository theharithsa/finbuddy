import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { CopyPlan } from './firestore-copy.mts';
import { planReceipts, type ReceiptObject, type ReceiptPlan } from './receipt-copy.mts';

const options = new Map(process.argv.slice(2).map(argument => {
  const split = argument.indexOf('=');
  assert.ok(argument.startsWith('--') && split > 2);
  return [argument.slice(2, split), argument.slice(split + 1)];
}));
const mode = options.get('mode');
assert.ok(mode === 'plan' || mode === 'copy' || mode === 'verify' || mode === 'revoke-legacy');
const manifest = options.get('manifest');
assert.ok(manifest && isAbsolute(manifest), 'An absolute private receipt manifest is required');
assert.ok(relative(await realpath('.'), await realpath(dirname(manifest))).startsWith('..'), 'Keep manifests outside source');
const project = 'finbuddy-2025';
const bucket = project + '.firebasestorage.app';
const admin = createRequire(resolve('api/package.json'))('firebase-admin/app') as {
  applicationDefault(): { getAccessToken(): Promise<{ access_token: string }> };
};
const credential = admin.applicationDefault();
async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const origin = new URL(url);
  assert.ok(origin.protocol === 'https:' && ['storage.googleapis.com', 'identitytoolkit.googleapis.com'].includes(origin.hostname));
  const token = (await credential.getAccessToken()).access_token;
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`,
    'X-Goog-User-Project': project, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(45_000), redirect: 'error' });
  if (response.status === 404 && method === 'GET') return null as T;
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Receipt provider request returned ${response.status}`); }
  return await response.json() as T;
}
const objectUrl = (name: string) => `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}`;
const persist = (plan: ReceiptPlan) => writeFile(manifest, JSON.stringify(plan), { mode: 0o600 });
function matching(source: ReceiptObject, target: ReceiptObject): boolean {
  return source.size === target.size && source.crc32c === target.crc32c && source.md5Hash === target.md5Hash;
}
try {
  if (mode === 'plan') {
    assert.ok(options.get('snapshot'));
    const financial = JSON.parse(await readFile(options.get('snapshot')!, 'utf8')) as CopyPlan;
    assert.equal(financial.project, project); assert.equal(financial.environment, 'prod');
    const files: ReceiptObject[] = [];
    let page = '';
    do {
      const result = await request<{ items?: ReceiptObject[]; nextPageToken?: string }>(
        `https://storage.googleapis.com/storage/v1/b/${bucket}/o?prefix=receipts%2F&maxResults=1000${page ? '&pageToken=' + encodeURIComponent(page) : ''}`);
      files.push(...result.items ?? []); page = result.nextPageToken ?? '';
    } while (page);
    const owners = new Set<string>();
    page = '';
    do {
      const result = await request<{ users?: Array<{ localId: string }>; nextPageToken?: string }>(
        `https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:batchGet?maxResults=1000${page ? '&nextPageToken=' + encodeURIComponent(page) : ''}`);
      for (const user of result.users ?? []) owners.add(user.localId);
      page = result.nextPageToken ?? '';
    } while (page);
    const plan = planReceipts(financial.entries.map(entry => entry.source), files, owners);
    await writeFile(manifest, JSON.stringify(plan), { flag: 'wx', mode: 0o600 });
    await writeFile(manifest + '.urls.json', JSON.stringify(plan.urls), { flag: 'wx', mode: 0o600 });
    process.stdout.write(`Read-only receipt plan: ${plan.objects.filter(file => file.owner).length} owner files; ${plan.objects.filter(file => !file.owner).length} recovery files. Originals unchanged.\n`);
  } else {
    assert.equal(options.get('ack-project'), project, 'Explicit target acknowledgement required');
    const plan = JSON.parse(await readFile(manifest, 'utf8')) as ReceiptPlan;
    assert.equal(plan.schemaVersion, 1); assert.equal(plan.project, project);
    assert.match(plan.id, /^[a-f0-9-]{36}$/);
    let verified = 0;
    for (const file of plan.objects) {
      assert.ok(file.source.name.startsWith('receipts/'));
      assert.ok(file.target.startsWith(file.owner ? `prod/receipts/${file.owner}/` : 'prod/recovery/receipts/'));
      const source = await request<ReceiptObject>(objectUrl(file.source.name));
      assert.ok(source && source.generation === file.source.generation && matching(file.source, source), 'Source receipt changed');
      let target = await request<ReceiptObject | null>(objectUrl(file.target));
      if (!target && mode === 'copy') {
        let rewrite = '';
        do {
          const url = objectUrl(file.source.name) + `/rewriteTo/b/${bucket}/o/${encodeURIComponent(file.target)}?ifSourceGenerationMatch=${file.source.generation}&ifGenerationMatch=0`
            + (rewrite ? '&rewriteToken=' + encodeURIComponent(rewrite) : '');
          const result = await request<{ done: boolean; rewriteToken?: string }>(url, 'POST', {
            contentType: file.source.contentType ?? 'application/octet-stream',
            metadata: { ...file.source.metadata, firebaseStorageDownloadTokens: file.downloadToken, finbuddyMigration: plan.id },
          });
          rewrite = result.done ? '' : result.rewriteToken ?? '';
          assert.ok(result.done || rewrite, 'Incomplete receipt rewrite');
        } while (rewrite);
        target = await request<ReceiptObject>(objectUrl(file.target));
      }
      assert.ok(target && matching(file.source, target), 'Destination receipt checksum mismatch');
      assert.equal(target.metadata?.finbuddyMigration, plan.id, 'Destination is outside this migration');
      assert.equal(target.metadata?.firebaseStorageDownloadTokens, file.downloadToken);
      file.targetGeneration = target.generation;
      if (mode === 'revoke-legacy' && source.metadata?.firebaseStorageDownloadTokens) {
        assert.equal(options.get('cutover-verified'), 'true', 'Verify application cutover before retiring old download capabilities');
        await request(objectUrl(file.source.name) + `?ifGenerationMatch=${source.generation}&ifMetagenerationMatch=${source.metageneration}`, 'PATCH', {
          metadata: { ...source.metadata, firebaseStorageDownloadTokens: null },
        });
        const revoked = await request<ReceiptObject>(objectUrl(file.source.name));
        assert.ok(!revoked.metadata?.firebaseStorageDownloadTokens, 'Legacy receipt capability was not retired');
      }
      await persist(plan); verified++;
    }
    process.stdout.write(`Receipt ${mode}: ${verified} checksum-verified objects; original file bytes retained.\n`);
  }
} catch (error) {
  await writeFile(manifest + '.failure.txt', error instanceof Error ? error.stack ?? error.message : 'Unknown receipt migration failure', { mode: 0o600 });
  process.stderr.write('Receipt migration stopped; details are retained with the private manifest.\n');
  process.exitCode = 1;
}
