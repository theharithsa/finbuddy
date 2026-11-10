import assert from 'node:assert/strict';
import { test } from 'node:test';
import { billDateInMonth } from '../shared/household';
import { documentId, expenseWrite } from '../src/contracts';
import { openApi, operations } from '../src/openapi';
import { receiptPath } from '../src/records';
import { bearer } from '../src/tokens';

test('OpenAPI documents each operation, authorization scheme, and write contract', () => {
  const spec = openApi();
  assert.equal(spec.openapi, '3.1.0');
  assert.equal(spec.servers[0].url, '/api/v1');
  assert.equal(new Set(operations.map(({ id }) => id)).size, operations.length);
  assert.equal(Object.values(spec.paths).reduce((count, path) => count + Object.keys(path).length, 0), operations.length);
  assert.ok(spec.paths['/expenses'].post);
  assert.ok(spec.paths['/developer/tokens'].post);
  assert.ok(spec.paths['/bills/{id}/payments'].post);
});

test('validates monetary precision, path segments and credential syntax', () => {
  const input = { amount: 125.99, category: 'Food', description: '', date: '2026-11-10' };
  assert.equal(expenseWrite.safeParse(input).success, true);
  assert.equal(expenseWrite.safeParse({ ...input, amount: 125.991 }).success, false);
  assert.equal(expenseWrite.safeParse({ ...input, uid: 'other' }).success, false);
  assert.equal(expenseWrite.safeParse({ ...input, date: '2026-02-30' }).success, false);
  for (const value of ['.', '..', 'a/b', '__id__']) assert.equal(documentId.safeParse(value).success, false);
  assert.throws(() => bearer('Bearer sample,duplicate'));
});

test('retains monthly bill clamping and rejects foreign receipt references', () => {
  const bill = { name: 'Rent', amountPaise: 1000, dueDate: '2024-01-31', repeat: 'monthly' } as const;
  assert.equal(billDateInMonth(bill, '2024-02'), '2024-02-29');
  const url = 'https://firebasestorage.googleapis.com/v0/b/finbuddy-2025.firebasestorage.app/o/receipts%2Fowner%2Fnote.pdf';
  assert.equal(receiptPath('owner', url), 'receipts/owner/note.pdf');
  assert.equal(receiptPath('other', url), undefined);
  assert.equal(receiptPath('owner', url.replace('firebasestorage.googleapis.com', 'files.example.test')), undefined);
  assert.equal(receiptPath('owner', url.replace('%2Fnote.pdf', '%2F..%2Fnote.pdf')), undefined);
});
