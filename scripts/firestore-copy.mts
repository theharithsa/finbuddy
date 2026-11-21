import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { dataRoot, type DataEnvironment } from '../api/shared/environment.ts';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface StoredDocument { name: string; fields?: Record<string, Json>; updateTime?: string; createTime?: string }
export interface CopyEntry { source: StoredDocument; target: string; fields: Record<string, Json>; digest: string }
export interface CopyPlan { schemaVersion: 1; project: string; environment: DataEnvironment; at: string; entries: CopyEntry[] }
export interface CopyProgress { schemaVersion: 1; targets: Record<string, { digest: string; updateTime: string }> }
export interface RetirementProgress { schemaVersion: 1; retired: Record<string, string> }
export type ProviderRequest = <T>(path: string, method?: string, body?: unknown) => Promise<T>;
export const legacyCollections = ['users', 'publicCategories', 'finbuddyDeveloper', 'finbuddyApiTokens'] as const;

function validatePlan(plan: CopyPlan): void {
  assert.equal(plan.schemaVersion, 1);
  assert.ok(plan.project === 'finbuddy-2025' || plan.project === 'demo-finbuddy');
  assert.equal(plan.environment, 'prod', 'Legacy recovery is restricted to production');
  const prefix = `projects/${plan.project}/databases/(default)/documents/`;
  const names = new Set<string>();
  for (const entry of plan.entries) {
    assert.ok(entry.source.name.startsWith(prefix));
    const path = entry.source.name.slice(prefix.length);
    assert.ok(legacyCollections.some(root => path.startsWith(root + '/')), 'Unexpected legacy root');
    assert.equal(path.split('/').length % 2, 0);
    assert.ok(entry.source.updateTime && !names.has(entry.source.name));
    names.add(entry.source.name);
    assert.equal(entry.target, prefix + dataRoot(plan.environment) + '/' + path);
    assert.equal(entry.digest, fieldsDigest(entry.fields), 'Changed migration plan');
  }
}

function canonical(value: Json): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function fieldsDigest(fields: Record<string, Json>): string {
  return createHash('sha256').update(canonical(fields)).digest('hex');
}
function rewriteReferences(value: Json, prefix: string, environment: DataEnvironment): Json {
  if (Array.isArray(value)) return value.map(item => rewriteReferences(item, prefix, environment));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    if (key === 'referenceValue' && typeof child === 'string' && child.startsWith(prefix + '/')) {
      const relative = child.slice(prefix.length + 1);
      if (legacyCollections.some(name => relative.startsWith(name + '/'))) {
        return [key, prefix + '/' + dataRoot(environment) + '/' + relative];
      }
    }
    return [key, rewriteReferences(child, prefix, environment)];
  }));
}
export async function snapshot(request: ProviderRequest, project: string, environment: DataEnvironment): Promise<CopyPlan> {
  assert.ok(project === 'finbuddy-2025' || project === 'demo-finbuddy', 'Unsupported migration project');
  const prefix = `projects/${project}/databases/(default)/documents`;
  const entries: CopyEntry[] = [];
  const pending: string[] = [...legacyCollections];
  while (pending.length) {
    const collection = pending.shift();
    assert.ok(collection && collection.split('/').length < 41, 'Invalid or excessive collection depth');
    let page = '';
    do {
      const result = await request<{ documents?: StoredDocument[]; nextPageToken?: string }>(
        prefix + '/' + collection + '?showMissing=true&pageSize=500' + (page ? '&pageToken=' + encodeURIComponent(page) : ''));
      const documents = result.documents ?? [];
      for (let offset = 0; offset < documents.length; offset += 16) {
        await Promise.all(documents.slice(offset, offset + 16).map(async document => {
        assert.ok(document.name.startsWith(prefix + '/' + collection + '/'), 'Unexpected source document');
        const relative = document.name.slice(prefix.length + 1);
        if (document.updateTime) {
          const fields = rewriteReferences(document.fields ?? {}, prefix, environment) as Record<string, Json>;
          entries.push({ source: document, target: prefix + '/' + dataRoot(environment) + '/' + relative,
            fields, digest: fieldsDigest(fields) });
          assert.ok(entries.length <= 50_000, 'Migration exceeds the reviewed document bound');
        }
        let childrenPage = '';
        do {
          const children = await request<{ collectionIds?: string[]; nextPageToken?: string }>(
            document.name + ':listCollectionIds', 'POST', { pageSize: 1000, ...(childrenPage ? { pageToken: childrenPage } : {}) });
          for (const child of children.collectionIds ?? []) {
            assert.ok(child && !child.includes('/'), 'Invalid child collection');
            pending.push(relative + '/' + child);
          }
          childrenPage = children.nextPageToken ?? '';
        } while (childrenPage);
        }));
      }
      page = result.nextPageToken ?? '';
    } while (page);
  }
  return { schemaVersion: 1, project, environment, at: new Date().toISOString(), entries: entries.sort((a, b) => a.target.localeCompare(b.target)) };
}
export async function copyPlan(request: ProviderRequest, plan: CopyPlan, progress: CopyProgress,
  persist: () => Promise<void>): Promise<{ copied: number; unchanged: number }> {
  assert.equal(plan.schemaVersion, 1);
  assert.equal(progress.schemaVersion, 1);
  assert.ok(plan.project === 'finbuddy-2025' || plan.project === 'demo-finbuddy');
  const prefix = `projects/${plan.project}/databases/(default)/documents`;
  let copied = 0, unchanged = 0;
  async function copyEntry(entry: CopyEntry): Promise<void> {
    const relative = entry.source.name.slice(prefix.length + 1);
    assert.ok(legacyCollections.some(name => relative.startsWith(name + '/')), 'Unexpected source root');
    assert.equal(entry.target, prefix + '/' + dataRoot(plan.environment) + '/' + relative);
    assert.equal(entry.digest, fieldsDigest(entry.fields), 'Changed migration plan');
    const source = await request<StoredDocument | null>(entry.source.name);
    assert.equal(source?.updateTime, entry.source.updateTime, 'Source changed; refresh the plan before cutover');
    assert.equal(fieldsDigest(source?.fields ?? {}), fieldsDigest(entry.source.fields ?? {}), 'Changed source fields');
    const current = await request<StoredDocument | null>(entry.target);
    if (current && fieldsDigest(current.fields ?? {}) === entry.digest) { unchanged++; return; }
    let precondition: { exists: false } | { updateTime: string } = { exists: false };
    if (current) {
      const owned = progress.targets[entry.target];
      assert.ok(owned && owned.digest === fieldsDigest(current.fields ?? {}) && owned.updateTime === current.updateTime,
        'Destination contains data outside this migration; refusing to overwrite');
      precondition = { updateTime: owned.updateTime };
    }
    await request(`projects/${plan.project}/databases/(default)/documents:commit`, 'POST', {
      writes: [{ update: { name: entry.target, fields: entry.fields }, currentDocument: precondition }],
    });
    const saved = await request<StoredDocument>(entry.target);
    assert.equal(fieldsDigest(saved.fields ?? {}), entry.digest, 'Destination readback mismatch');
    assert.ok(saved.updateTime);
    progress.targets[entry.target] = { digest: entry.digest, updateTime: saved.updateTime };
    copied++;
  }
  for (let offset = 0; offset < plan.entries.length; offset += 16) {
    const results = await Promise.allSettled(plan.entries.slice(offset, offset + 16).map(copyEntry));
    await persist();
    const failed = results.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }
  return { copied, unchanged };
}
export async function verifyPlan(request: ProviderRequest, plan: CopyPlan): Promise<number> {
  validatePlan(plan);
  let verified = 0;
  async function verifyEntry(entry: CopyEntry): Promise<void> {
    const [source, target] = await Promise.all([
      request<StoredDocument | null>(entry.source.name), request<StoredDocument | null>(entry.target),
    ]);
    assert.equal(source?.updateTime, entry.source.updateTime, 'Source changed after copy; cutover is blocked');
    assert.equal(fieldsDigest(source?.fields ?? {}), fieldsDigest(entry.source.fields ?? {}), 'Source fields changed');
    assert.ok(target && fieldsDigest(target.fields ?? {}) === entry.digest, 'Target verification failed');
    verified++;
  }
  for (let offset = 0; offset < plan.entries.length; offset += 16) {
    await Promise.all(plan.entries.slice(offset, offset + 16).map(verifyEntry));
  }
  const fresh = await snapshot(request, plan.project, plan.environment);
  assert.deepEqual(fresh.entries.map(entry => [entry.source.name, entry.source.updateTime]),
    plan.entries.map(entry => [entry.source.name, entry.source.updateTime]),
    'Source document set changed after snapshot; cutover is blocked');
  return verified;
}

export async function retireLegacy(request: ProviderRequest, plan: CopyPlan, progress: RetirementProgress,
  persist: () => Promise<void>): Promise<number> {
  validatePlan(plan);
  assert.equal(progress.schemaVersion, 1);
  const planned = new Map(plan.entries.map(entry => [entry.source.name, entry]));
  for (const [name, version] of Object.entries(progress.retired)) {
    assert.equal(planned.get(name)?.source.updateTime, version, 'Retirement progress belongs to another snapshot');
  }
  const remaining = plan.entries.filter(entry => !progress.retired[entry.source.name]);
  const fresh = await snapshot(request, plan.project, plan.environment);
  assert.deepEqual(fresh.entries.map(entry => [entry.source.name, entry.source.updateTime]),
    remaining.map(entry => [entry.source.name, entry.source.updateTime]), 'Legacy source set changed; retirement is blocked');
  // Check every remaining destination before the first deletion. Any new production
  // write requires operator reconciliation rather than weakening this check.
  for (let offset = 0; offset < remaining.length; offset += 16) {
    await Promise.all(remaining.slice(offset, offset + 16).map(async entry => {
      const target = await request<StoredDocument | null>(entry.target);
      assert.ok(target && fieldsDigest(target.fields ?? {}) === entry.digest, 'Destination changed; retirement is blocked');
    }));
  }
  const deepestFirst = [...remaining].sort((a, b) => b.source.name.split('/').length - a.source.name.split('/').length);
  let retired = 0;
  for (let offset = 0; offset < deepestFirst.length; offset += 200) {
    const batch = deepestFirst.slice(offset, offset + 200);
    await request(`projects/${plan.project}/databases/(default)/documents:commit`, 'POST', {
      writes: batch.map(entry => ({ delete: entry.source.name, currentDocument: { updateTime: entry.source.updateTime } })),
    });
    for (const entry of batch) { progress.retired[entry.source.name] = entry.source.updateTime!; retired++; }
    await persist();
  }
  assert.equal((await snapshot(request, plan.project, plan.environment)).entries.length, 0, 'Legacy records remain');
  return retired;
}

export async function restoreLegacy(request: ProviderRequest, plan: CopyPlan): Promise<number> {
  validatePlan(plan);
  let restored = 0;
  // Create-only recovery: customer records and namespace writes are never overwritten.
  for (const entry of plan.entries) {
    const existing = await request<StoredDocument | null>(entry.source.name);
    if (existing) {
      assert.equal(fieldsDigest(existing.fields ?? {}), fieldsDigest(entry.source.fields ?? {}), 'Recovery refuses an existing changed record');
      continue;
    }
    await request(`projects/${plan.project}/databases/(default)/documents:commit`, 'POST', {
      writes: [{ update: { name: entry.source.name, fields: entry.source.fields ?? {} }, currentDocument: { exists: false } }],
    });
    const saved = await request<StoredDocument | null>(entry.source.name);
    assert.equal(fieldsDigest(saved?.fields ?? {}), fieldsDigest(entry.source.fields ?? {}), 'Recovery readback mismatch');
    assert.ok(saved); restored++;
  }
  return restored;
}
