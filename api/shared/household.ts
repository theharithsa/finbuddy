import { z } from 'zod';

const label = z.string().trim().min(1).max(80);
export const maxPaise = 100_000_000_000;
const nonnegativePaise = z.number().int().min(0).max(maxPaise);
const positivePaise = nonnegativePaise.min(1);

export const incomeSchema = z.object({ name: label, amountPaise: positivePaise, date: z.iso.date() });
export const billSchema = z.object({
  name: label, amountPaise: positivePaise, dueDate: z.iso.date(), repeat: z.enum(['once', 'monthly', 'yearly']),
});
export const holdingKinds = ['Savings', 'Mutual fund / SIP', 'FD / RD', 'EPF / PPF / NPS', 'Gold', 'Shares', 'Other'] as const;
export const holdingSchema = z.object({ name: label, amountPaise: nonnegativePaise, kind: z.enum(holdingKinds), asOf: z.iso.date() });
export const paymentSchema = z.object({
  expenseId: z.string().min(1).refine((value) => !value.includes('/')),
  dueDate: z.iso.date(),
});

export const householdPaths = {
  income: 'householdIncome', bills: 'householdBills', holdings: 'householdHoldings', payments: 'householdBillPayments',
} as const;

export function billDateInMonth(bill: z.infer<typeof billSchema>, month: string): string | undefined {
  const firstMonth = bill.dueDate.slice(0, 7);
  if (month < firstMonth) return undefined;
  if (bill.repeat === 'once') return month === firstMonth ? bill.dueDate : undefined;
  if (bill.repeat === 'yearly' && firstMonth.slice(5) !== month.slice(5)) return undefined;
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  const day = Math.min(date.getUTCDate(), Number(bill.dueDate.slice(-2)));
  return `${month}-${String(day).padStart(2, '0')}`;
}

export function billPaymentKey(billId: string, dueDate: string): string {
  return `${billId}_${dueDate.slice(0, 7)}`;
}

export type PaymentInput = { amountPaise: number; date: string } | { expenseId: string };

interface PaymentExpense {
  amount: number;
  description: string;
  category: string;
  date: string;
  createdAt: string;
  billPaymentKey: string;
}

interface PaymentTransaction {
  readBill(id: string): Promise<unknown>;
  readPayment(key: string): Promise<unknown>;
  readExpense(id: string): Promise<{ billPaymentKey?: unknown } | undefined>;
  linkExpense(id: string, key: string): void;
  createExpense(id: string, expense: PaymentExpense): void;
  setPayment(key: string, payment: z.infer<typeof paymentSchema>): void;
}

export class BillPaymentError extends Error {
  constructor(readonly kind: 'missing' | 'conflict' | 'invalid', message: string) { super(message); }
}

export async function applyBillPayment(transaction: PaymentTransaction, billId: string, dueDate: string, input: PaymentInput, today: string) {
  const key = billPaymentKey(billId, dueDate);
  const billData = await transaction.readBill(billId);
  const paymentData = await transaction.readPayment(key);
  if (!billData) throw new BillPaymentError('missing', 'This bill was removed.');
  const bill = billSchema.parse(billData);
  if (billDateInMonth(bill, dueDate.slice(0, 7)) !== dueDate) {
    throw new BillPaymentError('conflict', 'This bill’s due date changed. Open it again.');
  }
  if (paymentData) {
    const { expenseId } = paymentSchema.parse(paymentData);
    if (await transaction.readExpense(expenseId)) return { status: 'already-recorded', expenseId } as const;
  }

  const expenseId = 'expenseId' in input ? input.expenseId : `bill-${key}`;
  const expense = await transaction.readExpense(expenseId);
  if ('expenseId' in input) {
    if (!expense) throw new BillPaymentError('missing', 'This expense was removed.');
    if (expense.billPaymentKey && expense.billPaymentKey !== key) {
      throw new BillPaymentError('conflict', 'This expense is already linked to a bill.');
    }
    transaction.linkExpense(expenseId, key);
  } else {
    const payment = incomeSchema.parse({ ...input, name: bill.name });
    if (payment.date > today) throw new BillPaymentError('invalid', 'Choose a payment date up to today.');
    if (expense && expense.billPaymentKey !== key) throw new BillPaymentError('conflict', 'Unable to link this payment.');
    if (!expense) transaction.createExpense(expenseId, {
      amount: payment.amountPaise / 100, description: bill.name, category: 'Bills & Utilities',
      date: payment.date, createdAt: new Date().toISOString(), billPaymentKey: key,
    });
  }
  transaction.setPayment(key, { expenseId, dueDate });
  return { status: 'recorded', expenseId } as const;
}
