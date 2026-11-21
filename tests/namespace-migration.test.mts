import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyPlan, fieldsDigest, snapshot, verifyPlan, type CopyProgress, type Json, type ProviderRequest, type StoredDocument } from '../scripts/firestore-copy.mts';

const prefix = 'projects/demo-finbuddy/databases/(default)/documents';
function provider() {
  const documents = new Map<string, StoredDocument>([
    [prefix + '/users/owner', { name: prefix + '/users/owner', updateTime: 'v1', fields: { enabled: { booleanValue: true } } }],
    [prefix + '/users/owner/expenses/expense', { name: prefix + '/users/owner/expenses/expense', updateTime: 'v2', fields: {
      amount: { doubleValue: 123.45 }, date: { timestampValue: '2026-01-01T00:00:00Z' },
      ownerRef: { referenceValue: prefix + '/users/owner' }, description: { stringValue: 'Synthetic migration' },
    } }],
    [prefix + '/Users/finvision/FinVision/data/plans/kept', { name: prefix + '/Users/finvision/FinVision/data/plans/kept',
      updateTime: 'fv1', fields: { note: { stringValue: 'Preserve FinVision' } } }],
  ]);
  let commits = 0;
  const request: ProviderRequest = async <T,>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    if (path.endsWith(':commit')) {
      commits++;
      const { writes } = body as { writes: Array<{ update: StoredDocument; currentDocument: { exists?: boolean; updateTime?: string } }> };
      for (const write of writes) {
        const prior = documents.get(write.update.name);
        if (write.currentDocument.exists === false) assert.equal(prior, undefined);
        if (write.currentDocument.updateTime) assert.equal(prior?.updateTime, write.currentDocument.updateTime);
        documents.set(write.update.name, { ...write.update, updateTime: 'copy-' + commits });
      }
      return {} as T;
    }
    if (path.endsWith(':listCollectionIds')) {
      const parent = path.slice(0, -':listCollectionIds'.length);
      const names = [...documents.keys()].filter(key => key.startsWith(parent + '/')).map(key => key.slice(parent.length + 1).split('/')[0]);
      return { collectionIds: [...new Set(names)] } as T;
    }
    if (path.includes('?')) {
      const collection = path.split('?')[0];
      return { documents: [...documents.values()].filter(doc => doc.name.startsWith(collection + '/')
        && !doc.name.slice(collection.length + 1).includes('/')).map(doc => structuredClone(doc)) } as T;
    }
    assert.equal(method, 'GET');
    return structuredClone(documents.get(path) ?? null) as T;
  };
  return { documents, request, commits: () => commits };
}
test('copy preserves typed financial fields, IDs and originals, rewrites references, and leaves FinVision untouched', async () => {
  const fake = provider();
  const plan = await snapshot(fake.request, 'demo-finbuddy', 'prod');
  assert.equal(plan.entries.length, 2);
  const progress: CopyProgress = { schemaVersion: 1, targets: {} };
  const result = await copyPlan(fake.request, plan, progress, async () => undefined);
  assert.equal(result.copied, 2);
  assert.equal(await verifyPlan(fake.request, plan), 2);
  const source = fake.documents.get(prefix + '/users/owner/expenses/expense');
  const target = fake.documents.get(prefix + '/prod/data/users/owner/expenses/expense');
  assert.deepEqual(target?.fields?.amount, source?.fields?.amount);
  assert.deepEqual(target?.fields?.date, source?.fields?.date);
  assert.deepEqual(target?.fields?.ownerRef, { referenceValue: prefix + '/prod/data/users/owner' });
  assert.equal(fake.documents.get(prefix + '/Users/finvision/FinVision/data/plans/kept')?.updateTime, 'fv1');
  assert.equal(source?.updateTime, 'v2');
  const repeat = await copyPlan(fake.request, plan, progress, async () => undefined);
  assert.equal(repeat.copied, 0); assert.equal(repeat.unchanged, 2); assert.equal(fake.commits(), 2);
});
test('source changes and unrelated destination writes block migration and acceptance', async () => {
  const fake = provider();
  const plan = await snapshot(fake.request, 'demo-finbuddy', 'prod');
  const progress: CopyProgress = { schemaVersion: 1, targets: {} };
  fake.documents.set(plan.entries[0].target, { name: plan.entries[0].target, updateTime: 'unrelated',
    fields: { unexpected: { stringValue: 'Existing destination data' } } });
  await assert.rejects(copyPlan(fake.request, plan, progress, async () => undefined), /refusing to overwrite/);
  fake.documents.delete(plan.entries[0].target);
  await copyPlan(fake.request, plan, progress, async () => undefined);
  fake.documents.set(prefix + '/users/owner/expenses/new', { name: prefix + '/users/owner/expenses/new',
    updateTime: 'new1', fields: { amount: { integerValue: '42' } } });
  await assert.rejects(verifyPlan(fake.request, plan), /document set changed/);
  fake.documents.get(plan.entries[0].source.name)!.updateTime = 'changed';
  await assert.rejects(copyPlan(fake.request, plan, progress, async () => undefined), /Source changed/);
});
test('digest ignores map ordering but preserves monetary types and array order', () => {
  const a: Record<string, Json> = { amount: { integerValue: '100' }, tags: { arrayValue: { values: [{ stringValue: 'a' }, { stringValue: 'b' }] } } };
  assert.equal(fieldsDigest(a), fieldsDigest({ tags: a.tags, amount: a.amount }));
  assert.notEqual(fieldsDigest(a), fieldsDigest({ ...a, amount: { doubleValue: 100 } }));
});
