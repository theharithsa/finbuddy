import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { StoredDocument } from './firestore-copy.mts';

export interface ReceiptObject {
  name: string; generation: string; metageneration: string; size: string;
  md5Hash?: string; crc32c?: string; contentType?: string; metadata?: Record<string, string>;
}
export interface ReceiptCopy {
  source: ReceiptObject; target: string; owner: string | null; downloadToken: string;
  targetGeneration?: string;
}
export interface ReceiptPlan {
  schemaVersion: 1; project: 'finbuddy-2025'; id: string; at: string;
  objects: ReceiptCopy[]; urls: Record<string, string>;
}
export function receiptObjectName(value: string, bucket: string): string | undefined {
  try {
    const url = new URL(value);
    const prefix = `/v0/b/${bucket}/o/`;
    if (url.origin !== 'https://firebasestorage.googleapis.com' || !url.pathname.startsWith(prefix)) return;
    const name = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!name.startsWith('receipts/')) return;
    return name;
  } catch { return; }
}
export function planReceipts(documents: StoredDocument[], objects: ReceiptObject[], owners: ReadonlySet<string>): ReceiptPlan {
  const bucket = 'finbuddy-2025.firebasestorage.app';
  const references = new Map<string, { owners: Set<string>; urls: Set<string> }>();
  for (const document of documents) {
    const match = document.name.match(/\/documents\/users\/([^/]+)\/expenses\/[^/]+$/);
    const field = document.fields?.receiptUrl;
    if (!match || !field || Array.isArray(field) || typeof field !== 'object' || typeof field.stringValue !== 'string') continue;
    const name = receiptObjectName(field.stringValue, bucket);
    assert.ok(name, 'Receipt reference outside the reviewed legacy bucket; reconcile before migration');
    const reference = references.get(name) ?? { owners: new Set<string>(), urls: new Set<string>() };
    reference.owners.add(match[1]); reference.urls.add(field.stringValue);
    references.set(name, reference);
  }
  const plan: ReceiptPlan = { schemaVersion: 1, project: 'finbuddy-2025', id: randomUUID(), at: new Date().toISOString(), objects: [], urls: {} };
  const sources = new Set<string>();
  for (const object of objects) {
    if (!object.name.startsWith('receipts/')) continue;
    sources.add(object.name);
    const reference = references.get(object.name);
    assert.ok(!reference || reference.owners.size === 1, 'Receipt has ambiguous account ownership');
    let owner = reference?.owners.values().next().value ?? null;
    const segments = object.name.split('/');
    if (segments.length === 3) {
      assert.ok(!owner || owner === segments[1], 'Receipt folder conflicts with its expense owner');
      if (owners.has(segments[1])) owner = segments[1];
    }
    assert.ok(!owner || owners.has(owner), 'Receipt owner is not in the current account directory');
    const hash = createHash('sha256').update(object.name).digest('hex').slice(0, 32);
    const extension = object.name.match(/\.(pdf|png|jpe?g|webp)$/i)?.[1]?.toLowerCase() ?? 'bin';
    const target = owner ? `prod/receipts/${owner}/legacy-${hash}.${extension}` : `prod/recovery/receipts/${hash}.${extension}`;
    const downloadToken = randomUUID();
    plan.objects.push({ source: object, target, owner, downloadToken });
    for (const url of reference?.urls ?? []) {
      plan.urls[url] = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(target)}?alt=media&token=${downloadToken}`;
    }
  }
  assert.ok([...references.keys()].every(name => sources.has(name)), 'Expense references a missing legacy receipt');
  return plan;
}
