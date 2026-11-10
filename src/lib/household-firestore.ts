import { addDoc, collection, deleteDoc, doc, onSnapshot, runTransaction, updateDoc } from 'firebase/firestore';
import type { z } from 'zod';
import { db } from '@/lib/firebase';
import { localDate } from '@/lib/finance-period';
import { observeOperation } from '@/lib/operation-monitoring';
import { billSchema, holdingSchema, incomeSchema, paymentSchema, type Household } from './household';
import { applyBillPayment, householdPaths as paths, type PaymentInput } from '../../api/shared/household';

const schemas = {
  income: incomeSchema,
  bills: billSchema,
  holdings: holdingSchema,
  payments: paymentSchema,
};
type Editable = Exclude<keyof Household, 'payments'>;

export function emptyHousehold(): Household {
  return { income: [], bills: [], holdings: [], payments: [] };
}

export function watchHousehold(uid: string, onData: (data: Household) => void, onError: () => void) {
  const state = emptyHousehold();
  const ready = new Set<keyof Household>();
  const subscriptions: (() => void)[] = [];
  function watch<K extends keyof Household, T>(
    key: K,
    schema: z.ZodType<T>,
    set: (value: (T & { id: string })[]) => void,
  ) {
    const ref = collection(db, 'users', uid, paths[key]);
    subscriptions.push(onSnapshot(ref, (snapshot) => {
      try {
        set(snapshot.docs.map((item) => ({ ...schema.parse(item.data()), id: item.id })));
        ready.add(key);
      } catch {
        ready.delete(key);
        onError();
        return;
      }
      if (ready.size === Object.keys(paths).length) onData({ ...state });
    }, () => {
      ready.delete(key);
      onError();
    }));
  }
  try {
    watch('income', incomeSchema, (value) => { state.income = value; });
    watch('bills', billSchema, (value) => { state.bills = value; });
    watch('holdings', holdingSchema, (value) => { state.holdings = value; });
    watch('payments', paymentSchema, (value) => { state.payments = value; });
  } catch {
    onError();
  }
  return () => subscriptions.forEach((unsubscribe) => unsubscribe());
}

export async function saveHouseholdEntry<K extends Editable>(
  uid: string,
  kind: K,
  draft: z.input<(typeof schemas)[K]>,
  id?: string,
): Promise<void> {
  const record = schemas[kind].parse(draft);
  if ('date' in record && record.date > localDate()) throw new Error('Income must already have been received.');
  const path = collection(db, 'users', uid, paths[kind]);
  await observeOperation('household.save', async () => {
    if (id) await updateDoc(doc(path, id), record);
    else await addDoc(path, record);
  });
}

export function removeHouseholdEntry(uid: string, kind: Editable, id: string): Promise<void> {
  return observeOperation('household.remove', () => deleteDoc(doc(db, 'users', uid, paths[kind], id)));
}

export function recordBillPayment(
  uid: string,
  billId: string,
  dueDate: string,
  input: PaymentInput,
): Promise<'recorded' | 'already-recorded'> {
  const bills = collection(db, 'users', uid, paths.bills);
  const payments = collection(db, 'users', uid, paths.payments);
  const expenses = collection(db, 'users', uid, 'expenses');

  return observeOperation('bill.payment', async () => {
    const result = await runTransaction(db, (transaction) => applyBillPayment({
      readBill: async (id) => (await transaction.get(doc(bills, id))).data(),
      readPayment: async (key) => (await transaction.get(doc(payments, key))).data(),
      readExpense: async (id) => (await transaction.get(doc(expenses, id))).data(),
      linkExpense: (id, key) => { transaction.update(doc(expenses, id), { billPaymentKey: key }); },
      createExpense: (id, expense) => { transaction.set(doc(expenses, id), expense); },
      setPayment: (key, payment) => { transaction.set(doc(payments, key), payment); },
    }, billId, dueDate, input, localDate()));
    return result.status;
  });
}
