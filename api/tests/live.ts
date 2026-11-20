import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { initializeApp, applicationDefault, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { tokenCreated } from '../shared/developer';

export interface LiveFixture {
  project: 'finbuddy-preprod' | 'finbuddy-2025';
  origin: string;
  probe: string;
  accounts: Array<{ uid: string; email: string; password: string; session: string }>;
}
const authAppName = 'finbuddy-release-auth';
function shortLivedCredential() {
  return {
    async getAccessToken() {
      const cli = process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud';
      const token = spawnSync(cli, ['auth', 'print-access-token'], { encoding: 'utf8', shell: process.platform === 'win32' });
      assert.equal(token.status, 0, 'Cannot acquire the scoped release identity');
      return { access_token: token.stdout.trim(), expires_in: 3000 };
    },
  };
}
export async function prepare(project: LiveFixture['project'], apiKey: string): Promise<LiveFixture> {
  assert.equal(process.env.FINBUDDY_ALLOW_SYNTHETIC_WRITES, 'true');
  assert.ok(['finbuddy-preprod', 'finbuddy-2025'].includes(project));
  assert.ok(apiKey);
  initializeApp({ projectId: project, storageBucket: `${project}.firebasestorage.app`, credential: applicationDefault() });
  // Auth administration consumes OAuth directly; data SDKs use their supported Google ADC path.
  const auth = getAuth(initializeApp({ projectId: project, credential: shortLivedCredential() }, authAppName));
  const fixture: LiveFixture = { project, origin: `https://${project}.web.app`, probe: randomUUID(), accounts: [] };
  try {
    for (let index = 0; index < 2; index++) {
      const uid = `finbuddy-release-${randomUUID()}`;
      const email = `${uid}@example.test`;
      const password = randomBytes(30).toString('base64url');
      await auth.createUser({ uid, email, password, emailVerified: true, displayName: 'Release test household' });
      const account = { uid, email, password, session: '' };
      fixture.accounts.push(account);
      const signed = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Referer: `${fixture.origin}/` }, body: JSON.stringify({ email, password, returnSecureToken: true }),
        signal: AbortSignal.timeout(20_000), redirect: 'error',
      });
      assert.equal(signed.status, 200, 'Synthetic account sign-in failed');
      account.session = (await signed.json() as { idToken: string }).idToken;
    }
    return fixture;
  } catch (error) { await cleanup(fixture); throw error; }
}

export async function cleanup(fixture: LiveFixture): Promise<void> {
  for (const account of fixture.accounts) {
    assert.match(account.uid, /^finbuddy-release-[a-f0-9-]{36}$/);
    assert.equal(account.email, `${account.uid}@example.test`);
    const db = getFirestore();
    const tokens = await db.collection('finbuddyApiTokens').where('owner', '==', account.uid).get();
    for (const token of tokens.docs) await token.ref.delete();
    await db.recursiveDelete(db.collection('finbuddyDeveloper').doc(account.uid));
    await db.recursiveDelete(db.collection('users').doc(account.uid));
    // Categories/people/templates live outside the user document; filter only this fixture owner.
    for (const collection of ['customCategories', 'customPeople', 'billTemplates', 'budgetTemplates']) {
      const owned = await db.collection(collection).where('userId', '==', account.uid).get();
      for (const row of owned.docs) await row.ref.delete();
    }
    await getStorage().bucket().deleteFiles({ prefix: `receipts/${account.uid}/` });
    await getAuth(getApp(authAppName)).deleteUser(account.uid);
    assert.equal((await db.collection('users').doc(account.uid).listCollections()).length, 0, 'Fixture cleanup left records');
  }
}

export async function exerciseApi(fixture: LiveFixture, checkpoint: (scenario: string) => void = () => undefined): Promise<string[]> {
  const passed: string[] = [];
  const [first, second] = fixture.accounts;
  const base = `${fixture.origin}/api/v1`;
  async function api(path: string, token?: string, method = 'GET', data?: unknown, key?: string): Promise<Response> {
    return fetch(base + path, { method, headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
      'X-FinBuddy-Request-Id': fixture.probe,
    }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}), redirect: 'error', signal: AbortSignal.timeout(30_000) });
  }
  async function mint(session: string, access: 'read' | 'read-write', days: 7 | null) {
    const response = await api('/developer/tokens', session, 'POST', { name: 'Release acceptance', access, days });
    assert.equal(response.status, 201, 'Token issuance failed');
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    return tokenCreated.parse(await response.json());
  }
  checkpoint('public-routes-and-denials');
  assert.equal((await api('/health')).status, 200);
  assert.equal((await api('/profile')).status, 401);
  assert.equal((await api('/profile', 'invalid')).status, 401);
  assert.equal((await api('/expenses', first.session)).status, 401);
  for (const route of ['/docs', '/docs/swagger-ui-bundle.js', '/openapi.json']) assert.equal((await api(route)).status, 200);
  passed.push('health-and-protected-denial', 'swagger-and-openapi');
  checkpoint('token-issuance-and-boundaries');
  const read = await mint(first.session, 'read', 7);
  const write = await mint(first.session, 'read-write', 7);
  const never = await mint(first.session, 'read', null);
  const other = await mint(second.session, 'read-write', 7);
  assert.equal(never.expiresAt, null);
  assert.equal((await api('/developer/tokens', read.token)).status, 401);
  const date = new Date().toISOString().slice(0, 10);
  const expense = { amount: 125.99, category: 'Food & Dining', description: 'Release synthetic fixture', date };
  assert.equal((await api('/expenses', read.token, 'POST', expense, randomUUID())).status, 403);
  assert.equal((await api('/expenses', write.token, 'POST', { ...expense, amount: -1 }, randomUUID())).status, 400);
  passed.push('token-boundaries-and-non-expiring-token', 'invalid-write-denied');
  checkpoint('expense-idempotency-and-isolation');
  const key = randomUUID();
  const created = await api('/expenses', write.token, 'POST', expense, key);
  assert.equal(created.status, 201);
  const record = await created.json() as { id: string };
  const retry = await api('/expenses', write.token, 'POST', expense, key);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json() as { id: string }).id, record.id);
  assert.equal((await api(`/expenses/${record.id}`, other.token)).status, 404);
  assert.equal((await api(`/expenses/${record.id}`, write.token, 'PATCH', { ...expense, amount: 130 })).status, 200);
  passed.push('expense-idempotency-update-and-second-account-denial');

  const inputs: Record<string, unknown> = {
    budgets: { category: 'Food & Dining', limit: 1000 },
    categories: { name: 'Release synthetic category', color: '#123456', icon: 'food' },
    people: { name: 'Release synthetic person', color: '#123456', icon: 'person', relationship: 'Family' },
    'bill-templates': { name: 'Release synthetic template', category: 'Bills & Utilities', description: '', amount: 499, frequency: 'monthly' },
    'budget-templates': { name: 'Release synthetic budget', description: '', budgets: [{ category: 'Food & Dining', limit: 1000 }], incomeLevel: 'custom', tags: [] },
    income: { name: 'Release synthetic income', amountPaise: 50_000, date },
    holdings: { name: 'Release synthetic saving', amountPaise: 25_000, kind: 'Savings', asOf: date },
    bills: { name: 'Release synthetic bill', amountPaise: 10_000, repeat: 'monthly', dueDate: date },
  };
  const ids: Record<string, string> = {};
  for (const [kind, input] of Object.entries(inputs)) {
    checkpoint(`${kind}-write-read-isolation`);
    const result = await api(`/${kind}`, write.token, 'POST', input, randomUUID());
    assert.equal(result.status, 201, `Create ${kind}`);
    const row = await result.json() as { id: string };
    ids[kind] = row.id;
    assert.equal((await api(`/${kind}/${row.id}`, read.token)).status, 200, `Read ${kind}`);
    assert.equal((await api(`/${kind}/${row.id}`, other.token)).status, 404, `Isolation ${kind}`);
    passed.push(`${kind}-write-read-isolation`);
  }
  checkpoint('bill-payment-and-summary');
  const paid = await Promise.all([0, 1].map(() => api(`/bills/${ids.bills}/payments`, write.token, 'POST', { date, dueDate: date, amountPaise: 10_000 })));
  for (const result of paid) assert.equal(result.status, 200);
  const payments = await Promise.all(paid.map(result => result.json())) as Array<{ expenseId: string }>;
  assert.equal(payments[0].expenseId, payments[1].expenseId);
  const totals = await api(`/summary?month=${date.slice(0, 7)}`, read.token);
  assert.equal(totals.status, 200);
  const summary = await totals.json() as { spendingPaise: number; incomePaise: number; holdingsPaise: number };
  assert.equal(summary.spendingPaise, 23_000);
  assert.equal(summary.incomePaise, 50_000);
  assert.equal(summary.holdingsPaise, 25_000);
  passed.push('concurrent-bill-payment-no-double-count', 'monthly-summary');

  checkpoint('receipt-rules-and-api-isolation');
  const bucket = getStorage().bucket();
  const receiptPath = `receipts/${first.uid}/release.txt`;
  const bytes = Buffer.from('FinBuddy synthetic receipt');
  await bucket.file(receiptPath).save(bytes, { contentType: 'text/plain', metadata: { metadata: { firebaseStorageDownloadTokens: 'synthetic' } } });
  const receiptUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(receiptPath)}?alt=media&token=synthetic`;
  const expenseRef = getFirestore().collection('users').doc(first.uid).collection('expenses').doc(record.id);
  await expenseRef.update({ receiptUrl });
  const download = await api(`/expenses/${record.id}/receipt`, read.token);
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  assert.equal((await api(`/expenses/${record.id}/receipt`, other.token)).status, 404);
  const privateUrl = receiptUrl.replace('&token=synthetic', '');
  const signedOut = await fetch(privateUrl, { signal: AbortSignal.timeout(20_000) });
  assert.ok([401, 403].includes(signedOut.status));
  const secondRead = await fetch(privateUrl, { headers: { Authorization: `Firebase ${second.session}` }, signal: AbortSignal.timeout(20_000) });
  assert.ok([401, 403].includes(secondRead.status));
  passed.push('live-receipt-rules-and-api-isolation');

  // Rehearse restoration only inside the synthetic account, including its associated file.
  checkpoint('synthetic-record-and-file-restore');
  const saved = (await expenseRef.get()).data();
  assert.ok(saved);
  await expenseRef.delete();
  await bucket.file(receiptPath).delete();
  await bucket.file(receiptPath).save(bytes, { contentType: 'text/plain', metadata: { metadata: { firebaseStorageDownloadTokens: 'synthetic' } } });
  await expenseRef.set(saved);
  assert.equal((await api(`/expenses/${record.id}/receipt`, read.token)).status, 200);
  passed.push('synthetic-record-and-receipt-restore');
  await expenseRef.update({ receiptUrl: FieldValue.delete() });
  assert.equal((await api(`/expenses/${record.id}`, write.token, 'DELETE')).status, 204);
  assert.equal((await api(`/expenses/${record.id}`, read.token)).status, 404);
  passed.push('expense-delete');
  checkpoint('token-expiry-and-owner-revocation');
  const tokenDoc = getFirestore().collection('finbuddyApiTokens').doc(read.id);
  assert.equal((await tokenDoc.get()).data()?.owner, first.uid);
  await tokenDoc.update({ expiresAt: '2000-01-01T00:00:00.000Z' });
  assert.equal((await api('/profile', read.token)).status, 401);
  assert.equal((await api(`/developer/tokens/${never.id}`, second.session, 'DELETE')).status, 204);
  assert.equal((await api('/profile', never.token)).status, 200);
  assert.equal((await api(`/developer/tokens/${never.id}`, first.session, 'DELETE')).status, 204);
  assert.equal((await api('/profile', never.token)).status, 401);
  assert.equal((await api(`/developer/tokens/${write.id}`, first.session, 'DELETE')).status, 204);
  assert.equal((await api('/profile', write.token)).status, 401);
  passed.push('expired-token-denial-and-owner-only-revocation');
  return passed;
}
