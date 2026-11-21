import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planReceipts, type ReceiptObject } from '../scripts/receipt-copy.mts';
import type { StoredDocument } from '../scripts/firestore-copy.mts';

const url = (name: string) => 'https://firebasestorage.googleapis.com/v0/b/finbuddy-2025.firebasestorage.app/o/' + encodeURIComponent(name) + '?alt=media&token=old-synthetic';
const document = (owner: string, file: string): StoredDocument => ({
  name: `projects/finbuddy-2025/databases/(default)/documents/users/${owner}/expenses/${owner}`,
  fields: { receiptUrl: { stringValue: url(file) } },
});
const object = (name: string): ReceiptObject => ({ name, generation: '1', metageneration: '1', size: '10', crc32c: 'synthetic' });
test('legacy links receive distinct owner paths and fresh tokens; unmatched files stay in recovery', () => {
  const plan = planReceipts([document('owner', 'receipts/shared.pdf')],
    [object('receipts/shared.pdf'), object('receipts/owner/shared.pdf'), object('receipts/unmatched.pdf')], new Set(['owner']));
  assert.equal(plan.objects.length, 3);
  assert.equal(new Set(plan.objects.map(file => file.target)).size, 3);
  assert.equal(plan.objects[0].owner, 'owner');
  assert.ok(plan.objects[0].target.startsWith('prod/receipts/owner/'));
  assert.ok(plan.objects[2].target.startsWith('prod/recovery/receipts/'));
  assert.equal(plan.objects[2].owner, null);
  assert.ok(!plan.urls[url('receipts/shared.pdf')].includes('old-synthetic'));
});
test('ambiguous ownership, missing files and foreign-bucket links block migration', () => {
  const owners = new Set(['a', 'b']);
  assert.throws(() => planReceipts([document('a', 'receipts/shared.pdf'), document('b', 'receipts/shared.pdf')],
    [object('receipts/shared.pdf')], owners), /ambiguous/);
  assert.throws(() => planReceipts([document('a', 'receipts/missing.pdf')], [], owners), /missing/);
  assert.throws(() => planReceipts([document('a', 'receipts/b/shared.pdf')],
    [object('receipts/b/shared.pdf')], owners), /conflicts/);
  const foreign = document('a', 'receipts/shared.pdf');
  foreign.fields = { receiptUrl: { stringValue: 'https://files.example.test/private.pdf' } };
  assert.throws(() => planReceipts([foreign], [], owners), /outside/);
});
