import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFile, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const repository = 'theharithsa/finbuddy';
const repositoryId = 1040949325;
const shaPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^[a-f0-9]{64}$/;
export interface Candidate {
  schemaVersion: 2;
  sourceSha: string;
  sourceTree: string;
  runId: number;
  runAttempt: number;
  createdAt: string;
  project: 'finbuddy-2025';
  preprodSite: 'finbuddy-2025-preprod';
  preprodRoot: 'preprod/data';
  productionRoot: 'prod/data';
  preprodDigest: string;
  productionDigest: string;
  apiDigest: string;
}
interface WorkflowRun {
  id: number;
  run_attempt: number;
  head_sha: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string;
  path: string;
  repository: { id: number };
  head_repository: { id: number };
}
interface Acceptance {
  context: string;
  state: string;
  description: string;
  created_at: string;
  creator: { login: string };
}
type GitHubRead = <T>(path: string) => Promise<T>;

export async function digestDirectory(folder: string, exclude: ReadonlySet<string> = new Set()): Promise<string> {
  const hash = createHash('sha256');
  const base = resolve(folder);
  async function visit(path: string): Promise<void> {
    const entries = await readdir(path, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (exclude.has(entry.name) || entry.name.startsWith('.env')) continue;
      assert.ok(!entry.isSymbolicLink(), 'Release artifacts must not contain symbolic links');
      const name = resolve(path, entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile()) {
        const bytes = await readFile(name);
        hash.update(relative(base, name).replaceAll('\\', '/')).update('\0');
        hash.update(String(bytes.length)).update('\0').update(bytes).update('\0');
      }
    }
  }
  await visit(base);
  return hash.digest('hex');
}

export function validateCandidate(value: unknown, expectedSha: string, tree: string, now = Date.now()): Candidate {
  assert.ok(value && typeof value === 'object', 'Missing candidate receipt');
  const row = value as Candidate;
  assert.equal(row.schemaVersion, 2);
  assert.equal(row.project, 'finbuddy-2025', 'Wrong candidate project');
  assert.equal(row.preprodSite, 'finbuddy-2025-preprod');
  assert.equal(row.preprodRoot, 'preprod/data');
  assert.equal(row.productionRoot, 'prod/data');
  assert.match(row.sourceSha, shaPattern);
  assert.equal(row.sourceSha, expectedSha, 'Changed source requires fresh pre-production acceptance');
  assert.equal(row.sourceTree, tree, 'Promotion result differs from accepted source');
  assert.match(row.sourceTree, shaPattern);
  for (const digest of [row.preprodDigest, row.productionDigest, row.apiDigest]) assert.match(digest, digestPattern);
  assert.ok(Number.isSafeInteger(row.runId) && row.runId > 0);
  assert.ok(Number.isSafeInteger(row.runAttempt) && row.runAttempt > 0);
  const age = now - Date.parse(row.createdAt);
  assert.ok(Number.isFinite(age) && age >= -60_000 && age < 24 * 60 * 60 * 1000, 'Stale or invalid acceptance receipt');
  return row;
}

export function validateAcceptance(status: Acceptance, candidate: Candidate, receiptDigest: string): void {
  assert.equal(status.context, 'preprod-acceptance');
  assert.equal(status.state, 'success', 'Pre-production acceptance is missing or failed');
  assert.equal(status.creator.login, 'theharithsa', 'Acceptance must come from the release owner');
  assert.equal(status.description, `run=${candidate.runId};attempt=${candidate.runAttempt};receipt=${receiptDigest}`,
    'Acceptance belongs to another run, attempt or artifact');
  assert.ok(Date.parse(status.created_at) >= Date.parse(candidate.createdAt), 'Acceptance predates the candidate');
}

export function validateRun(run: WorkflowRun, sha: string): void {
  assert.equal(run.repository.id, repositoryId);
  assert.equal(run.head_repository.id, repositoryId, 'Fork artifacts cannot be promoted');
  assert.equal(run.head_sha, sha);
  assert.equal(run.head_branch, 'preprod');
  assert.equal(run.event, 'push', 'Only a trusted staging push can produce a release');
  assert.equal(run.path, '.github/workflows/finbuddy.yml');
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success', 'Pre-production workflow did not pass');
}

export async function resolveAcceptedRun(sha: string, github: GitHubRead): Promise<{ runId: number; attempt: number; receiptDigest: string }> {
  assert.match(sha, shaPattern);
  const statuses = await github<Acceptance[]>(`commits/${sha}/statuses?per_page=100`);
  const status = statuses.find(row => row.context === 'preprod-acceptance');
  assert.ok(status && status.state === 'success', 'No successful pre-production acceptance for this source');
  assert.equal(status.creator.login, 'theharithsa');
  const match = /^run=(\d+);attempt=(\d+);receipt=([a-f0-9]{64})$/.exec(status.description);
  assert.ok(match, 'Malformed acceptance receipt identity');
  const runId = Number(match[1]);
  const attempt = Number(match[2]);
  const run = await github<WorkflowRun>(`actions/runs/${runId}`);
  validateRun(run, sha);
  assert.equal(run.run_attempt, attempt, 'Acceptance is stale after a workflow rerun');
  return { runId, attempt, receiptDigest: match[3] };
}

async function github<T>(path: string): Promise<T> {
  const token = process.env.GH_TOKEN;
  assert.ok(token, 'GitHub read token is required');
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(20_000), redirect: 'error',
  });
  assert.equal(response.status, 200, `GitHub metadata request failed (${response.status})`);
  return await response.json() as T;
}

function git(...args: string[]): string { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
async function output(values: Record<string, string | number>): Promise<void> {
  assert.ok(process.env.GITHUB_OUTPUT);
  await appendFile(process.env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'create') {
    const receipt: Candidate = {
      schemaVersion: 2, sourceSha: git('rev-parse', 'HEAD'), sourceTree: git('rev-parse', 'HEAD^{tree}'),
      runId: Number(process.env.GITHUB_RUN_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
      createdAt: new Date().toISOString(), project: 'finbuddy-2025',
      preprodSite: 'finbuddy-2025-preprod', preprodRoot: 'preprod/data', productionRoot: 'prod/data',
      preprodDigest: await digestDirectory('release/preprod'), productionDigest: await digestDirectory('release/production'),
      apiDigest: await digestDirectory('api', new Set(['node_modules', 'dist'])),
    };
    validateCandidate(receipt, receipt.sourceSha, receipt.sourceTree);
    await writeFile('release/receipt.json', JSON.stringify(receipt, null, 2) + '\n');
  } else if (command === 'resolve') {
    assert.ok(process.env.GITHUB_EVENT_PATH);
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8')) as {
      pull_request?: { head: { ref: string; sha: string; repo: { id: number } }; base: { ref: string } };
    };
    let sha: string;
    if (event.pull_request) {
      assert.equal(event.pull_request.base.ref, 'main');
      assert.equal(event.pull_request.head.ref, 'preprod', 'Production changes must be promoted from preprod');
      assert.equal(event.pull_request.head.repo.id, repositoryId);
      sha = event.pull_request.head.sha;
    } else {
      assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
      const pulls = await github<Array<{ merged_at: string | null; merge_commit_sha: string; head: { sha: string; ref: string; repo: { id: number } }; base: { ref: string } }>>(`commits/${git('rev-parse', 'HEAD')}/pulls`);
      const promotion = pulls.find(row => row.merged_at && row.merge_commit_sha === process.env.GITHUB_SHA && row.base.ref === 'main' && row.head.ref === 'preprod' && row.head.repo.id === repositoryId);
      assert.ok(promotion, 'Main has no merged preprod promotion PR');
      sha = promotion.head.sha;
    }
    const accepted = await resolveAcceptedRun(sha, github);
    await output({ source: sha, run: accepted.runId, attempt: accepted.attempt, receipt: accepted.receiptDigest });
  } else if (command === 'verify') {
    const bytes = await readFile('release/receipt.json');
    const row = validateCandidate(JSON.parse(bytes.toString('utf8')), process.env.CANDIDATE_SHA ?? git('rev-parse', 'HEAD'), git('rev-parse', 'HEAD^{tree}'));
    if (process.env.ACCEPTANCE_RECEIPT) {
      assert.equal(createHash('sha256').update(bytes).digest('hex'), process.env.ACCEPTANCE_RECEIPT, 'Receipt artifact changed');
      const statuses = await github<Acceptance[]>(`commits/${row.sourceSha}/statuses?per_page=100`);
      const accepted = statuses.find(status => status.context === 'preprod-acceptance');
      assert.ok(accepted);
      validateAcceptance(accepted, row, process.env.ACCEPTANCE_RECEIPT);
    }
    assert.equal(await digestDirectory('release/preprod'), row.preprodDigest, 'Pre-production artifact changed');
    assert.equal(await digestDirectory('release/production'), row.productionDigest, 'Production artifact changed');
    assert.equal(await digestDirectory('api', new Set(['node_modules', 'dist'])), row.apiDigest, 'API source changed');
    process.stdout.write(`Verified candidate ${row.sourceSha} from run ${row.runId}, attempt ${row.runAttempt}.\n`);
  } else throw new Error('Use release-control.mts create, resolve or verify');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : 'Release control failed'}\n`); process.exitCode = 1; });
}
