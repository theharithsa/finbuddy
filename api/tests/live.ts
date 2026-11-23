import { indiaDate, planSchema, previewSchema } from '../shared/planning';
import { dataRoot, deploymentTargets, firebaseProject, type DataEnvironment } from '../shared/environment';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { tokenCreated } from '../shared/developer';

export interface LiveFixture {
  project: 'finbuddy-2025';
  namespace: DataEnvironment;
  origin: string;
  probe: string;
  accounts: Array<{ uid: string; email: string; password: string; session: string }>;
}
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
let releaseToken: Promise<string> | undefined;
async function authAdmin(project: LiveFixture['project'], action: 'accounts' | 'accounts:update' | 'accounts:delete',
  body: Record<string, unknown>): Promise<void> {
  releaseToken ??= shortLivedCredential().getAccessToken().then(value => value.access_token);
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/${action}`, {
    method: 'POST', headers: { Authorization: `Bearer ${await releaseToken}`,
      'X-Goog-User-Project': project, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20_000), redirect: 'error',
  });
  await response.body?.cancel();
  assert.equal(response.status, 200, 'Scoped synthetic Auth administration failed');
}
export async function prepare(namespace: DataEnvironment, apiKey: string): Promise<LiveFixture> {
  assert.equal(process.env.FINBUDDY_ALLOW_SYNTHETIC_WRITES, 'true');
  assert.ok(namespace === 'prod' || namespace === 'preprod');
  const project = firebaseProject;
  assert.ok(apiKey);
  initializeApp({ projectId: project, storageBucket: `${project}.firebasestorage.app`, credential: applicationDefault() });
  // Auth uses an explicit quota-project header for both WIF and operator ADC.
  const fixture: LiveFixture = { project, namespace, origin: `https://${deploymentTargets[namespace].site}.web.app`, probe: randomUUID(), accounts: [] };
  try {
    for (let index = 0; index < 2; index++) {
      const uid = `finbuddy-release-${randomUUID()}`;
      const email = `${uid}@example.test`;
      const password = randomBytes(30).toString('base64url');
      await authAdmin(project, 'accounts', { localId: uid, email, password, emailVerified: true, displayName: 'Release test household' });
      const account = { uid, email, password, session: '' };
      fixture.accounts.push(account);
      await authAdmin(project, 'accounts:update', { localId: uid, customAttributes: JSON.stringify(namespace === 'preprod'
        ? { finbuddyPreprodAccess: true, finbuddyEnvironment: 'preprod' } : { finbuddyEnvironment: 'prod' }) });
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
    const tokens = await db.collection(`${dataRoot(fixture.namespace)}/finbuddyApiTokens`).where('owner', '==', account.uid).get();
    for (const token of tokens.docs) await token.ref.delete();
    await db.recursiveDelete(db.collection(`${dataRoot(fixture.namespace)}/finbuddyDeveloper`).doc(account.uid));
    await db.recursiveDelete(db.collection(`${dataRoot(fixture.namespace)}/users`).doc(account.uid));
    await db.recursiveDelete(db.doc(dataRoot(fixture.namespace) + '/finvisionPlans/' + account.uid));
    if (fixture.namespace === 'preprod') await db.recursiveDelete(db.doc('preprod/data/finvisionFixtures/' + account.uid));
    // Categories/people/templates live outside the user document; filter only this fixture owner.
    for (const collection of ['customCategories', 'customPeople', 'billTemplates', 'budgetTemplates']) {
      const owned = await db.collection(`${dataRoot(fixture.namespace)}/${collection}`).where('userId', '==', account.uid).get();
      for (const row of owned.docs) await row.ref.delete();
    }
    await getStorage().bucket().deleteFiles({ prefix: `${fixture.namespace}/receipts/${account.uid}/` });
    await authAdmin(fixture.project, 'accounts:delete', { localId: account.uid });
    assert.equal((await db.collection(`${dataRoot(fixture.namespace)}/users`).doc(account.uid).listCollections()).length, 0, 'Fixture cleanup left records');
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
  const receiptPath = `${fixture.namespace}/receipts/${first.uid}/release.txt`;
  const bytes = Buffer.from('FinBuddy synthetic receipt');
  await bucket.file(receiptPath).save(bytes, { contentType: 'text/plain', metadata: { metadata: { firebaseStorageDownloadTokens: 'synthetic' } } });
  const receiptUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(receiptPath)}?alt=media&token=synthetic`;
  const expenseRef = getFirestore().collection(`${dataRoot(fixture.namespace)}/users`).doc(first.uid).collection('expenses').doc(record.id);
  await expenseRef.update({ receiptUrl });
  const download = await api(`/expenses/${record.id}/receipt`, read.token);
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  assert.equal((await api(`/expenses/${record.id}/receipt`, other.token)).status, 404);
  const privateUrl = receiptUrl.replace('&token=synthetic', '');
  checkpoint('receipt-owner-storage-rule');
  const ownerRead = await fetch(privateUrl, { headers: { Authorization: `Firebase ${first.session}` }, signal: AbortSignal.timeout(20_000) });
  assert.equal(ownerRead.status, 200);
  assert.deepEqual(Buffer.from(await ownerRead.arrayBuffer()), bytes);
  checkpoint('receipt-signed-out-storage-denial');
  const signedOut = await fetch(privateUrl, { signal: AbortSignal.timeout(20_000) });
  assert.equal(signedOut.status, 403);
  checkpoint('receipt-second-account-storage-denial');
  const secondRead = await fetch(privateUrl, { headers: { Authorization: `Firebase ${second.session}` }, signal: AbortSignal.timeout(20_000) });
  assert.equal(secondRead.status, 403);
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
  const tokenDoc = getFirestore().collection(`${dataRoot(fixture.namespace)}/finbuddyApiTokens`).doc(read.id);
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

export async function exercisePlanning(fixture: LiveFixture): Promise<string[]> {
  const [owner, other] = fixture.accounts;
  assert.match(owner.uid, /^finbuddy-release-[a-f0-9-]{36}$/);
  const get = async (path: string, session: string, method = 'GET', body?: object, revision?: string) =>
    fetch(fixture.origin + '/api/v1/finvision' + path, { method, headers: { Authorization: 'Bearer ' + session,
      ...(body && { 'Content-Type': 'application/json' }), ...(revision && { 'If-Match': revision }) },
      ...(body && { body: JSON.stringify(body) }), signal: AbortSignal.timeout(25000) });
  const month=indiaDate().slice(0,7);
  const targetYear=Number(month.slice(0,4))+2;
  const goal = {id:'reserve', name:'Release reserve', todayValue:120000,targetYear,inflationRate:0};
  if (fixture.namespace === 'preprod') {
    const source = getFirestore().doc('preprod/data/finvisionFixtures/' + owner.uid);
    await source.create({accepting:true,limit:1,enrolled:0});
    await source.collection('Financial_Plans').doc('example').create({name:'Release scenario',goals:[goal],activeSavings:[]});
    const preview = previewSchema.parse(await (await get('/adoption',owner.session)).json());
    assert.equal(preview.source,'scenario:example');
    const input = {source:preview.source,fingerprint:preview.fingerprint,links:[]};
    for (let i=0;i<2;i++) assert.equal((await get('/adoption',owner.session,'POST',input)).status,200,'Synthetic transfer or replay failed');
    assert.equal((await source.get()).get('enrolled'),1);
  } else {
    // Exercise a production owner read/write without enrolling any family or reading a legacy profile.
    await getFirestore().doc('prod/data/finvisionPlans/' + owner.uid).create({revision:1,
      goals:[{id:'reserve', name:'Release reserve',targetPaise:12000000,targetMonth:targetYear+'-12',allocations:[]}],schedules:[]});
  }
  const changed = await get('/goals/reserve',owner.session,'PATCH',{name:'Release current goal'},'1');
  assert.equal(changed.status,200);
  assert.equal(planSchema.parse(await changed.json()).revision,2);
  assert.equal((await get('/goals/reserve',owner.session,'PATCH',{name:'Stale'},'1')).status,409);
  const inputs = await (await get('/projection',owner.session)).json() as {goals:{name:string}[]};
  assert.equal(inputs.goals[0].name,'Release current goal');
  const second = await (await get('/projection',other.session)).json() as {adopted:boolean};
  assert.equal(second.adopted,false);
  const deposit={id:'forecast',name:'Synthetic RD',monthlyPaise:500000,startMonth:month,endMonth:month,annualRate:0,type:'RD',goalId:'reserve',assetKey:null};
  const created=await get('/schedules',owner.session,'POST',deposit,'2');
  assert.equal(created.status,200);
  const revision=planSchema.parse(await created.json()).revision;
  const response=await get('/summary',owner.session);
  assert.equal(response.status,200);
  const summary=await response.json() as {goals:{id:string;saved:number;forecast:{balancePaise:number;principalPaise:number}}[];schedules:{id:string;maturity:{valuePaise:number}}[]};
  const projected=summary.schedules.find(s=>s.id==='forecast');
  assert.equal(projected?.maturity.valuePaise,500000);
  const planned=summary.goals.find(g=>g.id==='reserve');
  assert.ok(planned);
  assert.equal(planned.forecast.principalPaise,500000);
  assert.equal(planned.forecast.balancePaise,planned.saved+500000);
  assert.equal((await get('/schedules/forecast',other.session)).status,404);
  assert.equal((await get('/schedules/forecast',owner.session,'DELETE',undefined,String(revision))).status,200);
  return [...(fixture.namespace === 'preprod' ? ['planning-scenario-transfer-and-replay'] : []),'planning-owner-projection-conflict-and-isolation','planning-rd-summary-and-isolation'];
}

export async function exerciseNamespaceBoundary(fixture: LiveFixture, apiKey: string): Promise<string[]> {
  const owner = fixture.accounts[0];
  const base = `${fixture.origin}/api/v1`;
  const headers = { Authorization: `Bearer ${owner.session}`, 'Content-Type': 'application/json' };
  if (fixture.namespace === 'preprod') {
    const created = await fetch(base + '/developer/tokens', { method: 'POST', headers,
      body: JSON.stringify({ name: 'Cross-environment synthetic canary', access: 'read', days: 7 }),
      signal: AbortSignal.timeout(20_000), redirect: 'error' });
    assert.equal(created.status, 201);
    const canary = tokenCreated.parse(await created.json());
    try {
      const targets = [
        { url: `https://firestore.googleapis.com/v1/projects/${fixture.project}/databases/(default)/documents/prod/data/users/${owner.uid}/expenses/isolation-canary`, auth: `Bearer ${owner.session}`, status: 403 },
        { url: `https://firebasestorage.googleapis.com/v0/b/${fixture.project}.firebasestorage.app/o/${encodeURIComponent(`prod/receipts/${owner.uid}/isolation-canary.txt`)}?alt=media`, auth: `Firebase ${owner.session}`, status: 403 },
        { url: 'https://finbuddy-2025.web.app/api/v1/profile', auth: `Bearer ${canary.token}`, status: 401 },
      ];
      for (const target of targets) {
        const response = await fetch(target.url, { headers: { Authorization: target.auth },
          signal: AbortSignal.timeout(20_000), redirect: 'error' });
        assert.equal(response.status, target.status, 'Preprod data/API credentials crossed the production boundary');
        await response.body?.cancel();
      }
    } finally {
      const revoked = await fetch(base + '/developer/tokens/' + canary.id, { method: 'DELETE', headers,
        signal: AbortSignal.timeout(20_000), redirect: 'error' });
      assert.equal(revoked.status, 204); await revoked.body?.cancel();
    }
    return ['shared-project-preprod-data-and-api-credentials-denied-production'];
  }
  // The production role guard is checked only after that backend has actually
  // been upgraded; the staging run must remain compatible with the prior release.
  const stage = fixture.accounts[1];
  await authAdmin(fixture.project, 'accounts:update', { localId: stage.uid,
    customAttributes: JSON.stringify({ finbuddyEnvironment: 'preprod', finbuddyPreprodAccess: true }) });
  const signed = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Referer: `${fixture.origin}/` },
    body: JSON.stringify({ email: stage.email, password: stage.password, returnSecureToken: true }),
    signal: AbortSignal.timeout(20_000), redirect: 'error',
  });
  assert.equal(signed.status, 200);
  stage.session = (await signed.json() as { idToken: string }).idToken;
  const denied = await fetch(base + '/developer/tokens', { headers: { Authorization: `Bearer ${stage.session}` },
    signal: AbortSignal.timeout(20_000), redirect: 'error' });
  assert.equal(denied.status, 401, 'Production accepted a preprod-only sign-in session');
  await denied.body?.cancel();
  return ['production-role-guard-denied-preprod-session'];
}
