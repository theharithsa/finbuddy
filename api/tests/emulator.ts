import { adoptionInput, planSchema, previewSchema } from '../shared/planning';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
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

async function account(claims?: Record<string, unknown>) {
  const email = `${randomUUID()}@example.test`;
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'synthetic-account-only', returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  const result = await response.json() as { idToken: string; localId: string };
  if (!claims) return result;
  await getAuth(app).setCustomUserClaims(result.localId, claims);
  const signed = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'synthetic-account-only', returnSecureToken: true }),
  });
  assert.equal(signed.status, 200);
  return await signed.json() as { idToken: string; localId: string };
}

function api(path: string, token?: string, method = 'GET', data?: unknown, key?: string, revision?: string) {
  return fetch(`${base}${path}`, {
    method, headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(data !== undefined && { 'Content-Type': 'application/json' }),
      ...(key && { 'Idempotency-Key': key }),
      ...(revision && { 'If-Match': revision }),
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

test('shared-project rules separate prod/preprod and synthetic account permissions', async () => {
  const prod = await account();
  const partner = await account();
  const preprod = await account({ finbuddyPreprodAccess: true, finbuddyEnvironment: 'preprod' });
  const other = await account({ finbuddyPreprodAccess: true, finbuddyEnvironment: 'preprod' });
  const firestore = `http://${firestoreHost}/v1/projects/${project}/databases/(default)/documents`;
  const paths = [
    `prod/data/users/${preprod.localId}/expenses/canary`,
    `preprod/data/users/${preprod.localId}/expenses/canary`,
    `preprod/data/users/${prod.localId}/expenses/canary`,
    `users/${preprod.localId}/expenses/canary`,
    `unknown/data/users/${preprod.localId}/expenses/canary`,
    `users/${prod.localId}/expenses/canary`,
  ];
  const bucket = getStorage(app).bucket();
  const prodFile = `prod/receipts/${preprod.localId}/canary.txt`;
  const testFile = `preprod/receipts/${preprod.localId}/canary.txt`;
  const oldOwnerFile = `receipts/${prod.localId}/existing.txt`;
  const oldTestFile = `receipts/${preprod.localId}/existing.txt`;
  const visionProfile = `Users/${prod.localId}/FinVision/data/Personal_Details/profile`;
  const visionCode = 'SyncCodes/namespace-canary';
  const headers = (token: string) => ({ Authorization: `Bearer ${token}` });
  try {
    for (const path of paths) await db.doc(path).set({ note: 'Synthetic namespace test' });
    const read = (path: string, token?: string) => fetch(`${firestore}/${path}`, { headers: token ? headers(token) : undefined });
    assert.equal((await read(paths[1], preprod.idToken)).status, 200);
    for (const path of [paths[0], paths[3], paths[4]]) assert.equal((await read(path, preprod.idToken)).status, 403);
    assert.equal((await read(paths[1], other.idToken)).status, 403);
    assert.equal((await read(paths[2], prod.idToken)).status, 403);
    assert.equal((await read(paths[1])).status, 403);
    await db.doc(visionProfile).set({ linkedAccountIds: [partner.localId, preprod.localId] });
    await db.doc(visionCode).set({ uid: prod.localId, note: 'Synthetic FinVision fixture' });
    assert.equal((await read(visionProfile, prod.idToken)).status, 200);
    assert.equal((await read(visionProfile, partner.idToken)).status, 200);
    // Existing normal production identities retain the FinVision owner path.
    assert.equal((await read(visionCode, prod.idToken)).status, 200);
    assert.equal((await read(visionProfile, preprod.idToken)).status, 403);
    assert.equal((await read(visionCode, preprod.idToken)).status, 403);
    assert.equal((await read(paths[5], prod.idToken)).status, process.env.FINBUDDY_TEST_TRANSITION === 'true' ? 200 : 403);
    const write = await fetch(`${firestore}/${paths[0]}`, { method: 'PATCH', headers: {
      ...headers(preprod.idToken), 'Content-Type': 'application/json',
    }, body: JSON.stringify({ fields: { note: { stringValue: 'Denied synthetic write' } } }) });
    assert.equal(write.status, 403);
    assert.equal((await api('/developer/tokens', preprod.idToken)).status, 401);
    for (const path of [prodFile, testFile, oldOwnerFile, oldTestFile]) await bucket.file(path).save('Synthetic namespace receipt');
    const storage = (path: string, token: string) => fetch(
      `http://127.0.0.1:9199/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media`,
      { headers: { Authorization: `Firebase ${token}` } });
    assert.equal((await storage(testFile, preprod.idToken)).status, 200);
    assert.equal((await storage(prodFile, preprod.idToken)).status, 403);
    assert.equal((await storage(testFile, prod.idToken)).status, 403);
    assert.equal((await storage(testFile, other.idToken)).status, 403);
    assert.equal((await storage(oldOwnerFile, prod.idToken)).status, process.env.FINBUDDY_TEST_TRANSITION === 'true' ? 200 : 403);
    assert.equal((await storage(oldTestFile, preprod.idToken)).status, 403);
  } finally {
    for (const path of paths) await db.doc(path).delete();
    await db.doc(visionProfile).delete();
    await db.doc(visionCode).delete();
    for (const path of [prodFile, testFile, oldOwnerFile, oldTestFile]) await bucket.file(path).delete({ ignoreNotFound: true });
    for (const user of [prod, preprod, other, partner]) await getAuth(app).deleteUser(user.localId);
  }
});
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
    const raw = await db.collection('prod/data/finbuddyApiTokens').doc(read.id).get();
    assert.equal(typeof raw.data()?.digest, 'string');
    assert.equal(raw.data()?.token === undefined, true);
    const document = `http://${firestoreHost}/v1/projects/${project}/databases/(default)/documents/prod/data/finbuddyApiTokens/${read.id}`;
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
    const path = `prod/receipts/${first.localId}/sample.pdf`;
    await bucket.file(path).save(Buffer.from('Synthetic receipt'), { contentType: 'application/pdf' });
    const record = db.collection('prod/data/users').doc(first.localId).collection('expenses').doc(expenseId);
    const url = `http://127.0.0.1:9199/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=synthetic`;
    await record.update({ receiptUrl: url });
    const download = await api(`/expenses/${expenseId}/receipt`, read.token);
    assert.equal(download.status, 200);
    assert.equal(await download.text(), 'Synthetic receipt');
    assert.equal((await api(`/expenses/${expenseId}/receipt`, other.token)).status, 404);
    assert.equal((await api(`/expenses/${expenseId}`, write.token, 'DELETE')).status, 409);
    const row = await api(`/expenses/${expenseId}`, read.token);
    assert.equal((await row.json() as { receiptUrl?: string }).receiptUrl === undefined, true);
    await record.update({ receiptUrl: url.replace(encodeURIComponent(path), encodeURIComponent(`prod/receipts/${second.localId}/sample.pdf`)) });
    assert.equal((await api(`/expenses/${expenseId}/receipt`, read.token)).status, 404);
  });

  await t.test('Storage rules isolate receipt reads, metadata changes and deletes, and deny flat paths', async () => {
    const bucket = getStorage(app).bucket();
    const ownerPath = `prod/receipts/${first.localId}/rules-check.txt`;
    const legacyPath = 'receipts/legacy-rules-check.txt';
    const bytes = 'Synthetic rules fixture';
    await bucket.file(ownerPath).save(Buffer.from(bytes), { contentType: 'text/plain' });
    await bucket.file(legacyPath).save(Buffer.from(bytes), { contentType: 'text/plain' });
    const url = (path: string) => `http://127.0.0.1:9199/v0/b/${bucket.name}/o/${encodeURIComponent(path)}`;
    const owner = { Authorization: `Firebase ${first.idToken}` };
    const otherOwner = { Authorization: `Firebase ${second.idToken}` };
    try {
      const read = await fetch(url(ownerPath) + '?alt=media', { headers: owner });
      assert.equal(read.status, 200);
      assert.equal(await read.text(), bytes);
      assert.equal((await fetch(url(ownerPath) + '?alt=media')).status, 403);
      assert.equal((await fetch(url(ownerPath) + '?alt=media', { headers: otherOwner })).status, 403);
      assert.equal((await fetch(url(ownerPath), { method: 'PATCH', headers: { ...otherOwner, 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: 'application/pdf' }) })).status, 403);
      assert.equal((await fetch(url(ownerPath), { method: 'DELETE', headers: otherOwner })).status, 403);
      assert.equal((await fetch(url(ownerPath), { method: 'PATCH', headers: { ...owner, 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: 'text/plain' }) })).status, 200);
      for (const headers of [undefined, owner, otherOwner]) {
        assert.equal((await fetch(url(legacyPath) + '?alt=media', { headers })).status, 403);
      }
      assert.equal((await fetch(url(ownerPath), { method: 'DELETE', headers: owner })).status, 204);
    } finally {
      await bucket.file(ownerPath).delete({ ignoreNotFound: true });
      await bucket.file(legacyPath).delete({ ignoreNotFound: true });
    }
  });

  await t.test('keeps non-expiring tokens active alongside dated tokens and revokes either kind', async () => {
    const never = await mint(first.idToken, 'read', null);
    assert.equal(never.expiresAt, null);
    assert.ok(write.expiresAt);
    assert.equal(Date.parse(write.expiresAt) - Date.parse(write.createdAt), 7 * 86_400_000);
    const owned = db.collection('prod/data/finbuddyDeveloper').doc(first.localId);
    const readLookup = db.collection('prod/data/finbuddyApiTokens').doc(read.id);
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

test('FinVision owner transfer survives retries and protects existing plans and current projections', async () => {
  const owner = await account();
  const second = await account();
  const staging = await account({finbuddyPreprodAccess:true,finbuddyEnvironment:'preprod'});
  const root = 'Users/' + owner.localId + '/FinVision/data';
  const profile = db.doc(root + '/Personal_Details/profile');
  const gate = db.doc('prod/data/finvisionControl/pilot');
  await gate.set({ accepting:true, enrolled:0, limit:3 });
  const legacy = { goals:[{id:'g',name:'Reserve',todayValue:120000,targetYear:2028,inflationRate:0}], activeSavings:[] };
  await profile.set(legacy);
  const snapshot = db.doc(root + '/Financial_Plans/saved');
  await snapshot.set({...legacy,name:'Scenario'});
  const preview = async () => previewSchema.parse(await (await api('/finvision/adoption',owner.idToken)).json());
  const confirmation = (p: ReturnType<typeof previewSchema.parse>) => adoptionInput.parse({source:p.source,fingerprint:p.fingerprint,links:[]});
  const p = await preview();
  assert.equal(p.choices.length,2);
  await profile.update({note:'Changed between preview and confirmation'});
  assert.equal((await api('/finvision/adoption',owner.idToken,'POST',confirmation(p))).status,409);
  const current = confirmation(await preview());
  const results = await Promise.all([1,2].map(() => api('/finvision/adoption',owner.idToken,'POST',current)));
  assert.ok(results.every(r=>r.status===200));
  assert.equal((await gate.get()).get('enrolled'),1);
  const token = await mint(owner.idToken,'read-write',null);
  assert.equal((await api('/finvision',token.token)).status,403);
  assert.equal((await api('/finvision/projection',token.token)).status,401);
  const scoped = tokenCreated.parse(await (await api('/developer/tokens',owner.idToken,'POST',{name:'Planner',access:'read-write',days:null,planning:true})).json());
  const fd=db.doc('prod/data/users/'+owner.localId+'/householdHoldings/fd');
  await fd.set({amountPaise:8000000});
  const patch = (name:string) => api('/finvision/goals/g',scoped.token,'PATCH',{name,allocations:[{holdingId:'fd',basisPoints:5000}]},undefined,'1');
  const edits=await Promise.all([patch('First'),patch('Second')]);
  assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);
  const plan=planSchema.parse(await edits.find(r=>r.status===200)!.json());
  const add=()=>api('/finvision/goals',scoped.token,'POST',{id:'extra',name:'Fees',targetPaise:10000,targetMonth:'2028-01',allocations:[{holdingId:'fd',basisPoints:5001}]},undefined,String(plan.revision));
  assert.equal((await add()).status,409);
  const summary=await (await api('/finvision/summary',scoped.token)).json() as {goals:{saved:number}[]};
  assert.equal(summary.goals[0].saved,4000000);
  await gate.update({accepting:false});
  const projection=await (await api('/finvision/projection',owner.idToken)).json() as {adopted:boolean;goals:{name:string}[]};
  assert.equal(projection.goals[0].name,plan.goals[0].name);
  assert.equal((await (await api('/finvision/projection',second.idToken)).json() as {adopted:boolean}).adopted,false);
  assert.equal((await api('/finvision/projection',staging.idToken)).status,401);
  assert.equal((await api('/finvision/adoption',second.idToken)).status,403);
  const firestore='http://'+firestoreHost+'/v1/projects/'+project+'/databases/(default)/documents/';
  const hdr={Authorization:'Bearer '+owner.idToken,'Content-Type':'application/json'};
  for (const field of ['goals','activeSavings']) {
    const stale=await fetch(firestore+profile.path+'?updateMask.fieldPaths='+field,{method:'PATCH',headers:hdr,body:JSON.stringify({fields:{[field]:{arrayValue:{values:[{stringValue:'old tab'}]}}}})});
    assert.equal(stale.status,403);
  }
  assert.equal((await fetch(firestore+profile.path,{method:'DELETE',headers:hdr})).status,403);
  assert.equal((await fetch(firestore+profile.path+'?updateMask.fieldPaths=note',{method:'PATCH',headers:hdr,body:JSON.stringify({fields:{note:{stringValue:'Other details can still be edited'}}})})).status,200);
  assert.equal((await fetch(firestore+'prod/data/finvisionPlans/'+owner.localId,{headers:hdr})).status,403);
  assert.deepEqual((await profile.get()).get('goals'),legacy.goals);
  await profile.delete();
  assert.equal((await fetch(firestore+profile.path,{method:'PATCH',headers:hdr,body:JSON.stringify({fields:{goals:{arrayValue:{values:[]}}}})})).status,403);
});
