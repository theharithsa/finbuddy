import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expenseEvent } from '../src/expense-event-contract';

const context = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), traceFlags: 1 };
const source = '//firestore.googleapis.com/projects/finbuddy-preprod/databases/(default)/documents/users/synthetic-owner/expenses/synthetic';
const time = Date.parse('2026-11-20T03:00:00Z');
test('duplicate delivery has a stable event identity and resource sources stay pseudonymous', () => {
  const first = expenseEvent(source, 'cloud-event-id', time, 'created', 'pre-production', context);
  const duplicate = expenseEvent(source, 'cloud-event-id', time, 'created', 'pre-production', context);
  assert.deepEqual(first, duplicate);
  assert.equal(first.id, first.data['event.id']);
  assert.notEqual(first.id, expenseEvent(source, 'another-event', time, 'created', 'pre-production', context).id);
  assert.notEqual(first.id, expenseEvent(source + '-other', 'cloud-event-id', time, 'created', 'pre-production', context).id);
  assert.equal(JSON.stringify(first).includes('synthetic-owner'), false);
  assert.equal(JSON.stringify(first).includes('/documents/users/'), false);
});
test('each mutation has its actual type and only approved nonfinancial fields', () => {
  for (const change of ['created', 'updated', 'removed'] as const) {
    const event = expenseEvent(source, 'id', time, change, 'production', context, 'c'.repeat(40));
    assert.equal(event.type, `finbuddy.expense.${change}`);
    assert.equal(event.data['finbuddy.expense.change'], change);
    assert.equal(event.data['build.commit'], 'c'.repeat(40));
    for (const denied of ['amount', 'description', 'email', 'owner', 'uid', 'receiptUrl', 'token', 'password']) {
      assert.equal(denied in event.data, false);
    }
  }
});
test('missing trace context is omitted and an invalid source marker is not exported', () => {
  const event = expenseEvent(source, 'id', time, 'removed', 'pre-production', { traceId: '0'.repeat(32), spanId: '0'.repeat(16), traceFlags: 0 }, 'invalid');
  assert.equal('trace_id' in event.data, false);
  assert.equal('span_id' in event.data, false);
  assert.equal('build.commit' in event.data, false);
});

test('synthetic verification is a bounded flag without a user identifier', () => {
  const event = expenseEvent(source, 'id', time, 'created', 'pre-production', context, undefined, true);
  assert.equal(event.data['test.synthetic'], true);
  assert.equal(expenseEvent(source, 'id', time, 'created', 'production', context).data['test.synthetic'], false);
  assert.equal(JSON.stringify(event).includes('synthetic-owner'), false);
});
