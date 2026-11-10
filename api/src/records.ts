import { FieldPath, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import type { UserRecord } from 'firebase-admin/auth';
import { z } from 'zod';
import { applyBillPayment, householdPaths, maxPaise } from '../shared/household';
import { hasControlCharacters, paymentInput, paymentOutput, resource, resourceOutput, type ResourceName } from './contracts';
import { ApiError, requestData } from './errors';
import { digest } from './tokens';

export const receiptBucket = process.env.FUNCTIONS_EMULATOR === 'true' ? 'demo-finbuddy.appspot.com' : 'finbuddy-2025.firebasestorage.app';
const maximumSummaryRows = 2000;
export function receiptPath(uid: string, value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    const production = url.origin === 'https://firebasestorage.googleapis.com';
    const emulator = process.env.FUNCTIONS_EMULATOR === 'true' && url.origin === 'http://127.0.0.1:9199';
    if ((!production && !emulator) || url.username || url.password) return;
    const prefix = `/v0/b/${receiptBucket}/o/`;
    if (!url.pathname.startsWith(prefix)) return;
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    const segments = path.split('/');
    if (segments.length === 3 && segments[0] === 'receipts' && segments[1] === uid &&
        segments[2] && segments[2] !== '.' && segments[2] !== '..' && !segments[2].includes('\\') && !hasControlCharacters(segments[2])) return path;
  } catch {
    return;
  }
  return undefined;
}

function ownerCollection(db: Firestore, uid: string, collection: string) {
  return db.collection('users').doc(uid).collection(collection);
}

function project(schema: z.ZodObject, value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(schema.shape).flatMap(([field, property]) => {
    const parsed = property.safeParse(value[field]);
    return parsed.success && parsed.data !== undefined ? [[field, parsed.data]] : [];
  }));
}

function output(name: ResourceName, uid: string, id: string, data: DocumentData) {
  return project(resourceOutput(resource(name)), {
    ...data, id, ...(name === 'expenses' ? { hasReceipt: Boolean(receiptPath(uid, data.receiptUrl)) } : {}),
  });
}

export async function listRecords(db: Firestore, uid: string, name: ResourceName | 'bill-payments', limit: number, cursor?: string) {
  const collection = name === 'bill-payments' ? householdPaths.payments : resource(name).collection;
  const ordered = ownerCollection(db, uid, collection).orderBy(FieldPath.documentId());
  const snapshot = await (cursor ? ordered.startAfter(cursor) : ordered).limit(limit + 1).get();
  const items = snapshot.docs.slice(0, limit);
  return {
    items: items.map((item) => name === 'bill-payments'
      ? project(paymentOutput, { ...item.data(), id: item.id })
      : output(name, uid, item.id, item.data())),
    nextCursor: snapshot.size > limit ? items.at(-1)?.id ?? null : null,
  };
}

function recordMissing() { return new ApiError(404, 'not_found', 'That record was not found.'); }
export async function getRecord(db: Firestore, uid: string, name: ResourceName, id: string) {
  const data = (await ownerCollection(db, uid, resource(name).collection).doc(id).get()).data();
  if (!data) throw recordMissing();
  return output(name, uid, id, data);
}

export function indiaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format();
}

function validateDates(name: ResourceName, data: Record<string, unknown>) {
  if (name === 'income' && typeof data.date === 'string' && data.date > indiaToday()) {
    throw new ApiError(400, 'invalid_request', 'Income must already have been received.');
  }
}

function templateTotal(data: Record<string, unknown>) {
  return Array.isArray(data.budgets) ? {
    totalBudget: data.budgets.reduce<number>((sum, value: { limit: number }) => sum + Math.round(value.limit * 100), 0) / 100,
  } : {};
}

function defaults(user: UserRecord, name: ResourceName, input: Record<string, unknown>) {
  const createdAt = new Date().toISOString();
  if (resource(name).privateOnly) return {
    createdAt, userId: user.uid, createdBy: user.displayName ?? 'FinBuddy member', isPublic: false,
    ...(name === 'budget-templates' ? { ...templateTotal(input), usageCount: 0 } : {}),
  };
  if (name === 'budgets') return { spent: 0 };
  if (name === 'expenses') return { createdAt };
  if (name === 'bill-templates') return { createdAt, isDefault: false };
  return {};
}

export async function createRecord(db: Firestore, user: UserRecord, name: ResourceName, body: unknown, key: string) {
  const input = requestData(resource(name).write, body);
  const uid = user.uid;
  const fingerprint = digest(JSON.stringify(input));
  const operation = db.collection('finbuddyDeveloper').doc(uid).collection('creates').doc(digest(`${name}\0${key}`));
  const records = ownerCollection(db, uid, resource(name).collection);
  const record = records.doc();
  return db.runTransaction(async (tx) => {
    const previous = (await tx.get(operation)).data();
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new ApiError(409, 'idempotency_conflict', 'That key was used with different data.');
      const previousRecord = await tx.get(records.doc(previous.recordId as string));
      const data = previousRecord.data();
      if (!data) throw new ApiError(409, 'record_removed', 'The original record was removed. Use a new key for a new record.');
      return { data: output(name, uid, previousRecord.id, data), created: false };
    }
    validateDates(name, input);
    const data = { ...defaults(user, name, input), ...input };
    tx.create(record, data);
    tx.create(operation, { recordId: record.id, fingerprint, createdAt: new Date().toISOString() });
    return { data: output(name, uid, record.id, data), created: true };
  });
}

export async function changeRecord(db: Firestore, uid: string, name: ResourceName, id: string, change: { body: unknown } | { delete: true }) {
  const entry = resource(name);
  const input = 'body' in change ? requestData(entry.write.partial(), change.body) : undefined;
  if (input && !Object.keys(input).length) throw new ApiError(400, 'invalid_request', 'Provide at least one field.');
  if (input) validateDates(name, input);
  const ref = ownerCollection(db, uid, entry.collection).doc(id);
  return db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    if (!data) throw recordMissing();
    if (entry.privateOnly && data.isPublic === true) {
      throw new ApiError(409, 'shared_record', 'Manage shared records in the FinBuddy workspace.');
    }
    if (!input) {
      if (name === 'expenses' && data.receiptUrl) {
        throw new ApiError(409, 'receipt_attached', 'Delete expenses with attachments in the FinBuddy workspace.');
      }
      tx.delete(ref);
      return;
    }
    const updates = name === 'budget-templates' ? { ...input, ...templateTotal(input) } : input;
    tx.update(ref, updates);
    return output(name, uid, id, { ...data, ...updates });
  });
}

export function recordPayment(db: Firestore, uid: string, billId: string, input: z.infer<typeof paymentInput>) {
  const bills = ownerCollection(db, uid, householdPaths.bills);
  const payments = ownerCollection(db, uid, householdPaths.payments);
  const expenses = ownerCollection(db, uid, 'expenses');
  return db.runTransaction((tx) => applyBillPayment({
    readBill: async (id) => (await tx.get(bills.doc(id))).data(),
    readPayment: async (key) => (await tx.get(payments.doc(key))).data(),
    readExpense: async (id) => (await tx.get(expenses.doc(id))).data(),
    linkExpense: (id, key) => { tx.update(expenses.doc(id), { billPaymentKey: key }); },
    createExpense: (id, expense) => { tx.create(expenses.doc(id), expense); },
    setPayment: (key, payment) => { tx.set(payments.doc(key), payment); },
  }, billId, input.dueDate, input, indiaToday()));
}

export async function getReceiptPath(db: Firestore, uid: string, id: string) {
  const row = await ownerCollection(db, uid, 'expenses').doc(id).get();
  const path = receiptPath(uid, row.data()?.receiptUrl);
  if (!path) throw new ApiError(404, 'receipt_not_found', 'No owner-scoped receipt was found.');
  return path;
}

function paise(value: unknown, multiplier = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const amount = Math.round(value * multiplier);
  return amount >= 0 && amount <= maxPaise ? amount : 0;
}

export async function getSummary(db: Firestore, uid: string, month: string) {
  const max = maximumSummaryRows + 1;
  const lastDate = new Date(`${month}-01T00:00:00Z`);
  lastDate.setUTCMonth(lastDate.getUTCMonth() + 1, 0);
  const through = lastDate.toISOString().slice(0, 10);
  const dated = (collection: string) => ownerCollection(db, uid, collection).orderBy('date').startAt(`${month}-01`).endAt(`${through}\uf8ff`).limit(max).get();
  const [expenses, income, holdings, budgets] = await Promise.all([
    dated('expenses'), dated(householdPaths.income),
    ownerCollection(db, uid, householdPaths.holdings).limit(max).get(),
    ownerCollection(db, uid, 'budgets').limit(max).get(),
  ]);
  if ([expenses, income, holdings, budgets].some(({ size }) => size > maximumSummaryRows)) {
    throw new ApiError(422, 'summary_limit', 'This summary exceeds the record limit. Use the paginated resources.');
  }
  const byCategory = new Map<string, number>();
  for (const item of expenses.docs) {
    const row = item.data();
    const category = typeof row.category === 'string' && row.category ? row.category : 'Uncategorised';
    byCategory.set(category, (byCategory.get(category) ?? 0) + paise(row.amount, 100));
  }
  const spendingPaise = [...byCategory.values()].reduce((total, amount) => total + amount, 0);
  const incomePaise = income.docs.reduce((total, item) => total + paise(item.data().amountPaise), 0);
  const holdingsPaise = holdings.docs.reduce((total, item) => total + paise(item.data().amountPaise), 0);
  const budgetPaise = budgets.docs.reduce((total, item) => total + paise(item.data().limit, 100), 0);
  return {
    month, currency: 'INR', expenseCount: expenses.size, spendingPaise, incomePaise, holdingsPaise, budgetPaise,
    remainingPaise: incomePaise - spendingPaise,
    spendingByCategory: [...byCategory].map(([category, amountPaise]) => ({ category, amountPaise }))
      .sort((a, b) => b.amountPaise - a.amountPaise || a.category.localeCompare(b.category)),
  };
}
