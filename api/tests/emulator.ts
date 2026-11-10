import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { tokenCreated, tokenInfo } from '../shared/developer';

const project = 'demo-finbuddy';
const base = `http://127.0.0.1:5001/${project}/asia-south1/finbuddyApi/api/v1`;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
if (![firestoreHost, authHost, storageHost].every((host) => host && /^(127\.0\.0\.1|localhost):\d+$/.test(host))) {
  throw new Error('Run this suite only with the local FinBuddy emulators.');
}
const app = initializeApp({ projectId: project, storageBucket: `${project}.appspot.com` });
const db = getFirestore(app);

async function account() {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${randomUUID()}@example.test`, password: 'synthetic-account-only', returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  return await response.json() as { idToken: string; localId: string };
}

function api(path: string, token?: string, method = 'GET', data?: unknown, key?: string) {
  return fetch(`${base}${path}`, {
    method, headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(data !== undefined && { 'Content-Type': 'application/json' }),
      ...(key && { 'Idempotency-Key': key }),
    },
    ...(data !== undefined && { body: JSON.stringify(data) }),
    signal: AbortSignal.timeout(25_000),
  });
}

async function mint(session: string, access: 'read' | 'read-write', days: 7 | null = 7) {
  const response = await api('/developer/tokens', session, 'POST', { name: 'Emulator test', access, days });
  assert.equal(response.status, 201);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  return tokenCreated.parse(await response.json());
}

const expense = { amount: 125.99, category: 'Food & Dining', description: 'Synthetic expense', date: '2026-01-12' };
const fixtures = {
  budgets: { category: 'Food & Dining', limit: 1000 },
  categories: { name: 'Synthetic', color: '#123456', icon: 'food' },
  people: { name: 'Synthetic', color: '#123456', icon: 'person', relationship: 'Family' },
  'bill-templates': { name: 'Internet', category: 'Bills & Utilities', description: '', amount: 499, frequency: 'monthly' },
  'budget-templates': { name: 'Sample budget', description: '', budgets: [{ category: 'Food & Dining', limit: 1000 }], incomeLevel: 'custom', tags: [] },
  income: { name: 'Salary', amountPaise: 50_000, date: '2026-01-01' },
  holdings: { name: 'Savings', amountPaise: 25_000, kind: 'Savings', asOf: '2026-01-01' },
  bills: { name: 'Rent', amountPaise: 10_000, repeat: 'monthly', dueDate: '2026-01-31' },
};

test('FinBuddy HTTP API through Firebase emulators', async (t) => {
  const first = await account();
  const second = await account();
  const read = await mint(first.idToken, 'read');
  const write = await mint(first.idToken, 'read-write');
  const other = await mint(second.idToken, 'read-write');

  await t.test('serves Swagger and enforces separate token boundaries', async () => {
    const docs = await api('/docs');
    assert.equal(docs.status, 200);
    assert.match(await docs.text(), /FinBuddy API/);
    assert.equal((await api('/docs/swagger-ui-bundle.js')).status, 200);
    assert.equal((await api('/openapi.json')).status, 200);
    assert.equal((await api('/expenses')).status, 401);
    assert.equal((await api('/expenses', first.idToken)).status, 401);
    assert.equal((await api('/developer/tokens', read.token)).status, 401);
    assert.equal((await api('/expenses', read.token, 'POST', expense, 'read-denied')).status, 403);
    const listing = await api('/developer/tokens', first.idToken);
    const listed = await listing.json() as { id: string; token?: string; digest?: string }[];
    assert.equal(listing.status, 200);
    assert.equal(listed.length, 2);
    assert.ok(listed.every((item) => !item.token && !item.digest));
    const raw = await db.collection('finbuddyApiTokens').doc(read.id).get();
    assert.equal(typeof raw.data()?.digest, 'string');
    assert.equal(raw.data()?.token === undefined, true);
    const document = `http://${firestoreHost}/v1/projects/${project}/databases/(default)/documents/finbuddyApiTokens/${read.id}`;
    assert.equal((await fetch(document, { headers: { Authorization: `Bearer ${first.idToken}` } })).status, 403);
    assert.equal((await api(`/developer/tokens/${read.id}`, second.idToken, 'DELETE')).status, 204);
    assert.equal((await api('/profile', read.token)).status, 200);
  });

  let expenseId = '';
  await t.test('handles retries, validates fields, and isolates records between accounts', async () => {
    const writes = await Promise.all([api('/expenses', write.token, 'POST', expense, 'expense-1'), api('/expenses', write.token, 'POST', expense, 'expense-1')]);
    assert.deepEqual(writes.map(({ status }) => status).sort(), [200, 201]);
    const [a, b] = await Promise.all(writes.map((response) => response.json())) as [{ id: string }, { id: string }];
    expenseId = a.id;
    assert.equal(a.id, b.id);
    assert.equal((await api('/expenses', write.token, 'POST', { ...expense, amount: 11 }, 'expense-1')).status, 409);
    assert.equal((await api('/expenses', write.token, 'POST', { ...expense, amount: 11.123 }, 'precision')).status, 400);
    assert.equal((await api('/expenses', write.token, 'POST', expense)).status, 400);
    assert.equal((await api(`/expenses/${expenseId}`, other.token)).status, 404);
    assert.equal((await api(`/expenses/${expenseId}`, other.token, 'DELETE')).status, 404);
    assert.equal((await api(`/expenses/${expenseId}`, write.token, 'PATCH', { amount: 130.25 })).status, 200);
    assert.equal((await api(`/expenses/${expenseId}`, write.token, 'PATCH', { userId: second.localId })).status, 400);
    assert.equal((await api('/expenses/%2F', write.token)).status, 400);
  });

  const ids: Record<string, string> = {};
  await t.test('writes each supported resource and builds the monthly summary', async () => {
    for (const [resource, input] of Object.entries(fixtures)) {
      const result = await api(`/${resource}`, write.token, 'POST', input, `test-${resource}`);
      assert.equal(result.status, 201, resource);
      const row = await result.json() as { id: string };
      ids[resource] = row.id;
      assert.equal((await api(`/${resource}/${row.id}`, read.token)).status, 200, resource);
      assert.equal((await api(`/${resource}?limit=1`, read.token)).status, 200, resource);
    }
    const summary = await api('/summary?month=2026-01', read.token);
    assert.equal(summary.status, 200);
    const totals = await summary.json() as { spendingPaise: number; incomePaise: number; holdingsPaise: number };
    assert.equal(totals.spendingPaise, 13_025);
    assert.equal(totals.incomePaise, 50_000);
    assert.equal(totals.holdingsPaise, 25_000);
  });

  await t.test('records one bill payment during concurrent calls', async () => {
    assert.ok(ids.bills);
    const path = `/bills/${ids.bills}/payments`;
    const payload = { dueDate: '2026-02-28', date: '2026-02-15', amountPaise: 10_000 };
    const paid = await Promise.all([api(path, write.token, 'POST', payload), api(path, write.token, 'POST', payload)]);
    for (const response of paid) assert.equal(response.status, 200);
    const entries = await Promise.all(paid.map((response) => response.json())) as { status: string; expenseId: string }[];
    assert.deepEqual(entries.map(({ status }) => status).sort(), ['already-recorded', 'recorded']);
    assert.equal(entries[0].expenseId, entries[1].expenseId);
    const list = await api('/bill-payments', read.token);
    const payments = await list.json() as { items: unknown[] };
    assert.equal(payments.items.length, 1);
    const expenses = await api('/expenses?limit=1', read.token);
    const firstPage = await expenses.json() as { nextCursor: string; items: { id: string }[] };
    assert.ok(firstPage.nextCursor);
    const following = await api(`/expenses?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor)}`, read.token);
    const secondPage = await following.json() as { nextCursor: string | null; items: { id: string }[] };
    assert.equal(secondPage.nextCursor, null);
    assert.notEqual(firstPage.items[0].id, secondPage.items[0].id);
  });

  await t.test('only streams a receipt from the verified owner prefix', async () => {
    assert.ok(expenseId);
    const bucket = getStorage(app).bucket();
    const path = `receipts/${first.localId}/sample.pdf`;
    await bucket.file(path).save(Buffer.from('Synthetic receipt'), { contentType: 'application/pdf' });
    const record = db.collection('users').doc(first.localId).collection('expenses').doc(expenseId);
    const url = `http://127.0.0.1:9199/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=synthetic`;
    await record.update({ receiptUrl: url });
    const download = await api(`/expenses/${expenseId}/receipt`, read.token);
    assert.equal(download.status, 200);
    assert.equal(await download.text(), 'Synthetic receipt');
    assert.equal((await api(`/expenses/${expenseId}/receipt`, other.token)).status, 404);
    assert.equal((await api(`/expenses/${expenseId}`, write.token, 'DELETE')).status, 409);
    const row = await api(`/expenses/${expenseId}`, read.token);
    assert.equal((await row.json() as { receiptUrl?: string }).receiptUrl === undefined, true);
    await record.update({ receiptUrl: url.replace(encodeURIComponent(path), encodeURIComponent(`receipts/${second.localId}/sample.pdf`)) });
    assert.equal((await api(`/expenses/${expenseId}/receipt`, read.token)).status, 404);
  });

  await t.test('keeps non-expiring tokens active alongside dated tokens and revokes either kind', async () => {
    const never = await mint(first.idToken, 'read', null);
    assert.equal(never.expiresAt, null);
    assert.ok(write.expiresAt);
    assert.equal(Date.parse(write.expiresAt) - Date.parse(write.createdAt), 7 * 86_400_000);
    const owned = db.collection('finbuddyDeveloper').doc(first.localId);
    const readLookup = db.collection('finbuddyApiTokens').doc(read.id);
    const expiresAt = '2000-01-01T00:00:00.000Z';
    const existing = tokenInfo.array().parse((await owned.get()).data()?.tokens);
    await owned.update({ tokens: existing.map((row) => row.id === read.id ? { ...row, expiresAt } : row) });
    await readLookup.update({ expiresAt });
    assert.equal((await api('/profile', read.token)).status, 401);
    const another = await mint(first.idToken, 'read');
    assert.equal((await readLookup.get()).exists, false);
    const listing = await api('/developer/tokens', first.idToken);
    assert.equal(listing.status, 200);
    const listed = tokenInfo.array().parse(await listing.json());
    assert.deepEqual(listed.map(({ id }) => id), [another.id, never.id, write.id]);
    assert.equal(listed[1].expiresAt, null);
    assert.equal((await api('/profile', never.token)).status, 200);
    assert.equal((await api('/expenses', never.token, 'POST', expense, 'never-read-denied')).status, 403);
    assert.equal((await api(`/developer/tokens/${never.id}`, second.idToken, 'DELETE')).status, 204);
    assert.equal((await api('/profile', never.token)).status, 200);
    assert.equal((await api(`/developer/tokens/${never.id}`, first.idToken, 'DELETE')).status, 204);
    assert.equal((await api('/profile', never.token)).status, 401);
    assert.equal((await api(`/developer/tokens/${write.id}`, first.idToken, 'DELETE')).status, 204);
    assert.equal((await api('/profile', write.token)).status, 401);
  });
});
