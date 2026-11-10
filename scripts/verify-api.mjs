import assert from 'node:assert/strict';

const [endpoint] = process.argv.slice(2);
const targets = new Set([
  'https://finbuddy-2025.web.app',
  'https://asia-south1-finbuddy-2025.cloudfunctions.net/finbuddyApi',
]);
assert.ok(targets.has(endpoint), 'Use the FinBuddy Hosting or Functions production endpoint.');

const read = (path) => fetch(`${endpoint}/api/v1/${path}`, {
  cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
});
const health = await read('health');
assert.equal(health.status, 200, 'API health must respond with 200.');
assert.match(health.headers.get('content-type') ?? '', /application\/json/);
assert.deepEqual(await health.json(), { status: 'ok' });

const [schema, unsigned] = await Promise.all([read('openapi.json'), read('expenses')]);
assert.equal(schema.status, 200);
assert.match(schema.headers.get('content-type') ?? '', /application\/json/);
const spec = await schema.json();
assert.equal(spec.info.title, 'FinBuddy API');
assert.ok(spec.paths['/developer/tokens']?.post, 'Token issuance must appear in OpenAPI.');
assert.equal(unsigned.status, 401, 'Expense reads must require authentication.');
assert.match(unsigned.headers.get('cache-control') ?? '', /no-store/);
await unsigned.arrayBuffer();
process.stdout.write(`Verified FinBuddy API health, OpenAPI and authentication at ${endpoint}\n`);
