import assert from 'node:assert/strict';

const [endpoint, expectedRevision] = process.argv.slice(2);
const targets = new Set([
  'https://finbuddy-2025.web.app',
  'https://myfinbuddy.app',
  'https://preprod.myfinbuddy.app',
  'https://asia-south1-finbuddy-2025.cloudfunctions.net/finbuddyApi',
  'https://finbuddy-2025-preprod.web.app',
  'https://asia-south1-finbuddy-2025.cloudfunctions.net/finbuddyApiPreprod',
]);
assert.ok(targets.has(endpoint), 'Use a FinBuddy Hosting or Functions endpoint.');

const read = (path) => fetch(`${endpoint}/api/v1/${path}`, {
  cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
});
const health = await read('health');
assert.equal(health.status, 200, 'API health must respond with 200.');
assert.equal(health.headers.get('x-finbuddy-environment'),
  endpoint === 'https://preprod.myfinbuddy.app' || endpoint.includes('finbuddy-2025-preprod.') || endpoint.endsWith('/finbuddyApiPreprod') ? 'preprod' : 'prod',
  'API must serve the selected data namespace');
assert.match(health.headers.get('content-type') ?? '', /application\/json/);
assert.deepEqual(await health.json(), { status: 'ok' });
if (expectedRevision) {
  assert.match(expectedRevision, /^[a-f0-9]{40}$/);
  assert.equal(health.headers.get('x-finbuddy-revision'), expectedRevision, 'API revision mismatch');
}

const [schema, unsigned] = await Promise.all([read('openapi.json'), read('expenses')]);
assert.equal(schema.status, 200);
assert.match(schema.headers.get('content-type') ?? '', /application\/json/);
const spec = await schema.json();
assert.equal(spec.info.title, 'FinBuddy API');
const issuance = spec.paths['/developer/tokens']?.post;
assert.ok(issuance, 'Token issuance must appear in OpenAPI.');
const days = issuance.requestBody.content['application/json'].schema.properties.days;
const expiresAt = issuance.responses[201].content['application/json'].schema.properties.expiresAt;
assert.ok(days.anyOf?.some(({ type }) => type === 'null'), 'OpenAPI must accept a non-expiring token request.');
assert.ok(expiresAt.anyOf?.some(({ type }) => type === 'null'), 'OpenAPI must describe a non-expiring token response.');
assert.equal(unsigned.status, 401, 'Expense reads must require authentication.');
assert.match(unsigned.headers.get('cache-control') ?? '', /no-store/);
await unsigned.arrayBuffer();
process.stdout.write(`Verified FinBuddy API health, OpenAPI and authentication at ${endpoint}\n`);
