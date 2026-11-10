import { z } from 'zod';
import { monthRange, shiftMonth } from '@/lib/finance-period';
import { formatCurrency, type Expense } from '@/lib/types';

import { billDateInMonth, billPaymentKey, billSchema, holdingSchema, incomeSchema, maxPaise, paymentSchema } from '../../api/shared/household';
export { billDateInMonth, billPaymentKey, billSchema, holdingKinds, holdingSchema, incomeSchema, paymentSchema } from '../../api/shared/household';

export type IncomeDraft = z.infer<typeof incomeSchema>;
export type BillDraft = z.infer<typeof billSchema>;
export type HoldingDraft = z.infer<typeof holdingSchema>;
export type Income = IncomeDraft & { id: string };
export type Bill = BillDraft & { id: string };
export type Holding = HoldingDraft & { id: string };
export type BillPayment = z.infer<typeof paymentSchema> & { id: string };

export interface Household {
  income: Income[];
  bills: Bill[];
  holdings: Holding[];
  payments: BillPayment[];
}

export function money(paise: number): string {
  return formatCurrency(paise / 100);
}

export function parsePaise(value: FormDataEntryValue | null, allowZero = false): number | undefined {
  const normalized = typeof value === 'string' ? value.trim().replace(',', '.') : '';
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(normalized)) return undefined;
  const [rupees, decimal = ''] = normalized.split('.');
  const paise = Number(rupees) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise > maxPaise || paise < (allowZero ? 0 : 1)) return undefined;
  return paise;
}

export interface BillOccurrence {
  bill: Bill;
  dueDate: string;
  expense?: Expense;
}

export function listBillOccurrences(
  bills: Bill[],
  payments: BillPayment[],
  expenses: Expense[],
  month: string,
  asOf = monthRange(month).to,
): BillOccurrence[] {
  const byPayment = new Map(payments.map((payment) => [payment.id, payment.expenseId]));
  const byExpense = new Map(expenses.map((expense) => [expense.id, expense]));
  const occurrences: BillOccurrence[] = [];
  for (const bill of bills) {
    const step = bill.repeat === 'yearly' ? 12 : 1;
    for (let dueMonth = bill.dueDate.slice(0, 7); dueMonth <= month; dueMonth = shiftMonth(dueMonth, step)) {
      const dueDate = billDateInMonth(bill, dueMonth);
      if (!dueDate) break;
      const expenseId = byPayment.get(billPaymentKey(bill.id, dueDate));
      const linkedExpense = expenseId ? byExpense.get(expenseId) : undefined;
      const expense = linkedExpense && linkedExpense.date.slice(0, 10) <= asOf ? linkedExpense : undefined;
      if (dueMonth === month || !expense || expense.date.slice(0, 7) === month) {
        occurrences.push({ bill, dueDate, expense });
      }
      if (bill.repeat === 'once' || dueMonth === month) break;
    }
  }
  return occurrences.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.bill.name.localeCompare(b.bill.name));
}
