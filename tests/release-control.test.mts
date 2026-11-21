import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCandidate, validateAcceptance, validateRun, resolveAcceptedRun, digestDirectory, type Candidate } from '../scripts/release-control.mts';

const sha = 'a'.repeat(40);
const tree = 'b'.repeat(40);
const digest = 'c'.repeat(64);
const receipt = (): Candidate => ({ schemaVersion: 2, sourceSha: sha, sourceTree: tree, runId: 123,
  runAttempt: 2, createdAt: new Date(Date.now() - 1000).toISOString(), project: 'finbuddy-2025',
  preprodSite: 'finbuddy-2025-preprod', preprodRoot: 'preprod/data', productionRoot: 'prod/data',
  preprodDigest: digest, productionDigest: digest, apiDigest: digest });
const status = () => ({ context: 'preprod-acceptance', state: 'success', creator: { login: 'theharithsa' },
  created_at: new Date().toISOString(), description: `run=123;attempt=2;receipt=${digest}` });
const run = () => ({ id: 123, run_attempt: 2, head_sha: sha, head_branch: 'preprod', event: 'push',
  status: 'completed', conclusion: 'success', path: '.github/workflows/finbuddy.yml',
  repository: { id: 1040949325 }, head_repository: { id: 1040949325 } });

test('accepts an identified, current, isolated candidate and its owner acceptance', () => {
  const candidate = receipt();
  assert.equal(validateCandidate(candidate, sha, tree), candidate);
  validateAcceptance(status(), candidate, digest);
  validateRun(run(), sha);
});
test('rejects missing acceptance, changed source, changed merge content and wrong project', () => {
  assert.throws(() => validateCandidate(null, sha, tree));
  assert.throws(() => validateCandidate(receipt(), 'd'.repeat(40), tree));
  assert.throws(() => validateCandidate(receipt(), sha, 'd'.repeat(40)));
  assert.throws(() => validateCandidate({ ...receipt(), project: 'finbuddy-preprod' }, sha, tree));
  assert.throws(() => validateCandidate({ ...receipt(), schemaVersion: 1 }, sha, tree));
  assert.throws(() => validateCandidate({ ...receipt(), preprodRoot: 'prod/data' }, sha, tree));
  assert.throws(() => validateCandidate({ ...receipt(), preprodSite: 'finbuddy-2025' }, sha, tree));
});
test('rejects stale and future receipts', () => {
  assert.throws(() => validateCandidate({ ...receipt(), createdAt: new Date(0).toISOString() }, sha, tree));
  assert.throws(() => validateCandidate({ ...receipt(), createdAt: new Date(Date.now() + 120_000).toISOString() }, sha, tree));
});
test('rejects failed acceptance, wrong actor, changed artifact and superseded attempt', async () => {
  assert.throws(() => validateAcceptance({ ...status(), state: 'failure' }, receipt(), digest));
  assert.throws(() => validateAcceptance({ ...status(), creator: { login: 'someone-else' } }, receipt(), digest));
  assert.throws(() => validateAcceptance(status(), receipt(), 'd'.repeat(64)));
  const fake = async <T,>(path: string): Promise<T> => (path.startsWith('commits/') ? [status()] : { ...run(), run_attempt: 3 }) as T;
  await assert.rejects(resolveAcceptedRun(sha, fake), /stale/);
});
test('rejects failed, incomplete, fork, PR, wrong-branch and wrong-workflow runs', () => {
  for (const update of [{ conclusion: 'failure' }, { status: 'in_progress' }, { head_repository: { id: 7 } },
    { event: 'pull_request' }, { head_branch: 'main' }, { path: '.github/workflows/other.yml' }]) {
    assert.throws(() => validateRun({ ...run(), ...update }, sha));
  }
});
test('resolves only the latest acceptance for the exact successful run and attempt', async () => {
  const good = async <T,>(path: string): Promise<T> => (path.startsWith('commits/') ? [status()] : run()) as T;
  assert.deepEqual(await resolveAcceptedRun(sha, good), { runId: 123, attempt: 2, receiptDigest: digest });
  const missing = async <T,>(): Promise<T> => [] as T;
  await assert.rejects(resolveAcceptedRun(sha, missing), /No successful/);
  const rejected = async <T,>(): Promise<T> => [{ ...status(), state: 'failure' }, status()] as T;
  await assert.rejects(resolveAcceptedRun(sha, rejected), /No successful/);
});
test('artifact digest changes for bytes and paths, and excludes local environment and build inputs', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'finbuddy-release-test-'));
  try {
    await writeFile(join(folder, 'index.html'), 'first');
    const first = await digestDirectory(folder, new Set(['node_modules']));
    await writeFile(join(folder, '.env.local'), 'synthetic-test-value');
    await mkdir(join(folder, 'node_modules'));
    await writeFile(join(folder, 'node_modules', 'fixture'), 'synthetic');
    assert.equal(await digestDirectory(folder, new Set(['node_modules'])), first);
    await writeFile(join(folder, 'index.html'), 'second');
    assert.notEqual(await digestDirectory(folder, new Set(['node_modules'])), first);
    const second = await digestDirectory(folder, new Set(['node_modules']));
    await writeFile(join(folder, 'another.html'), 'second');
    assert.notEqual(await digestDirectory(folder, new Set(['node_modules'])), second);
  } finally { await rm(folder, { recursive: true, force: true }); }
});
