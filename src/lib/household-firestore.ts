import { addDoc, collection, deleteDoc, doc, onSnapshot, runTransaction, updateDoc } from 'firebase/firestore';
import type { z } from 'zod';
import { db } from '@/lib/firebase';
import { localDate } from '@/lib/finance-period';
import { observeOperation } from '@/lib/operation-monitoring';
import { billDateInMonth, billPaymentKey, billSchema, holdingSchema, incomeSchema, paymentSchema, type Household } from './household';

const schemas = {
  income: incomeSchema,
  bills: billSchema,
  holdings: holdingSchema,
  payments: paymentSchema,
};
const paths = {
  income: 'householdIncome',
  bills: 'householdBills',
  holdings: 'householdHoldings',
  payments: 'householdBillPayments',
} as const;

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

type PaymentInput = { amountPaise: number; date: string } | { expenseId: string };

export function recordBillPayment(
  uid: string,
  billId: string,
  dueDate: string,
  input: PaymentInput,
): Promise<'recorded' | 'already-recorded'> {
  const month = dueDate.slice(0, 7);
  const key = billPaymentKey(billId, dueDate);
  const billRef = doc(db, 'users', uid, paths.bills, billId);
  const paymentRef = doc(db, 'users', uid, paths.payments, key);
  const expenses = collection(db, 'users', uid, 'expenses');
  const expenseRef = doc(expenses, 'expenseId' in input ? input.expenseId : `bill-${key}`);

  return observeOperation('bill.payment', () => runTransaction(db, async (transaction) => {
    const billSnapshot = await transaction.get(billRef);
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!billSnapshot.exists()) throw new Error('This bill was removed.');
    const bill = billSchema.parse(billSnapshot.data());
    if (billDateInMonth(bill, month) !== dueDate) throw new Error('This bill’s due date changed. Open it again.');
    if (paymentSnapshot.exists()) {
      const existing = paymentSchema.parse(paymentSnapshot.data());
      if ((await transaction.get(doc(expenses, existing.expenseId))).exists()) return 'already-recorded';
    }

    const expenseSnapshot = await transaction.get(expenseRef);
    if ('expenseId' in input) {
      if (!expenseSnapshot.exists()) throw new Error('This expense was removed.');
      const linked = expenseSnapshot.data().billPaymentKey;
      if (linked && linked !== key) throw new Error('This expense is already linked to a bill.');
      transaction.update(expenseRef, { billPaymentKey: key });
    } else {
      const payment = incomeSchema.parse({ ...input, name: bill.name });
      if (payment.date > localDate()) throw new Error('Choose a payment date up to today.');
      if (expenseSnapshot.exists()) {
        if (expenseSnapshot.data().billPaymentKey !== key) throw new Error('Unable to link this payment.');
      } else {
        transaction.set(expenseRef, {
          amount: payment.amountPaise / 100,
          description: bill.name,
          category: 'Bills & Utilities',
          date: payment.date,
          createdAt: new Date().toISOString(),
          billPaymentKey: key,
        });
      }
    }
    transaction.set(paymentRef, { expenseId: expenseRef.id, dueDate });
    return 'recorded';
  }));
}
