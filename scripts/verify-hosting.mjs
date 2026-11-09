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
function iconLink(rel) {
  const tag = html.match(new RegExp(`<link rel="${rel}"[^>]*>`))?.[0];
  const path = tag?.match(/href="(\/icons\/[^"]+)"/)?.[1];
  assert.ok(path, 'Missing ' + rel);
  return path;
}

async function verifyPng(path, size) {
  assert.match(path, /^\/icons\/[a-z0-9-]+\.png$/);
  const icon = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15_000) });
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get('content-type') ?? '', /^image\/png/);
  const bytes = Buffer.from(await icon.arrayBuffer());
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), size, path + ' width');
  assert.equal(bytes.readUInt32BE(20), size, path + ' height');
}

async function verifyIco() {
  const response = await fetch(new URL('/favicon.ico', origin), { signal: AbortSignal.timeout(15_000) });
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.readUInt32LE(0), 0x00010000);
  assert.equal(bytes.readUInt16LE(4), 3);
  for (const [index, size] of [16, 32, 48].entries()) {
    assert.equal(bytes[6 + index * 16], size);
    assert.equal(bytes[7 + index * 16], size);
  }
}

const manifestResponse = await fetch(new URL('/manifest.json', origin), { signal: AbortSignal.timeout(15_000) });
assert.equal(manifestResponse.status, 200);
const manifest = await manifestResponse.json();
const expectedIcons = [['any', 192], ['any', 512], ['maskable', 512]];
const shortcutIcons = manifest.shortcuts.flatMap(({ icons }) => icons);
assert.equal(shortcutIcons.length, 2);
await Promise.all([
  verifyIco(),
  verifyPng(iconLink('icon'), 32),
  verifyPng(iconLink('apple-touch-icon'), 180),
  verifyPng('/icons/buddy-mark-v1.png', 208),
  ...expectedIcons.map(([purpose, size]) => {
    const match = manifest.icons.find((icon) => icon.purpose === purpose && icon.sizes === `${size}x${size}`);
    assert.ok(match, `Missing ${purpose} ${size} install icon`);
    return verifyPng(match.src, size);
  }),
  ...shortcutIcons.map(({ src }) => verifyPng(src, 96)),
]);
process.stdout.write(`Verified FinBuddy ${revision} at ${origin.origin}\n`);
