import assert from 'node:assert/strict';

const [url, revision] = process.argv.slice(2);
if (!url || !/^[a-f0-9]{40}$/.test(revision ?? '')) {
  throw new Error('Usage: node scripts/verify-hosting.mjs <site URL> <40-character Git SHA>');
}
const origin = new URL(url);
assert.equal(origin.protocol, 'https:');
assert.match(origin.hostname, /^finbuddy-2025(?:--[a-z0-9-]+)?\.web\.app$/);
const response = await fetch(new URL('/', origin), { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
assert.equal(response.status, 200);
assert.match(response.headers.get('cache-control') ?? '', /no-cache/);
const html = await response.text();
assert.ok(html.includes(`name="finbuddy-revision" content="${revision}"`), 'Hosting revision mismatch');
const asset = html.match(/<script[^>]+src="(\/assets\/[^"]+)"/)?.[1];
assert.ok(asset, 'Missing application JavaScript');
const module = await fetch(new URL(asset, origin), { signal: AbortSignal.timeout(15_000) });
assert.equal(module.status, 200);
assert.match(module.headers.get('content-type') ?? '', /javascript/);
assert.match(module.headers.get('cache-control') ?? '', /immutable/);
await module.arrayBuffer();
process.stdout.write(`Verified FinBuddy ${revision} at ${origin.origin}\n`);
