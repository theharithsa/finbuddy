import { describe, expect, it } from 'vitest';
import { billDateInMonth, billPaymentKey, holdingSchema, incomeSchema, listBillOccurrences, parsePaise, type Bill, type BillPayment } from '@/lib/household';
import type { Expense } from '@/lib/types';

describe('household amounts and due dates', () => {
  it('accepts exact paise and permits a zero value only when requested', () => {
    expect(parsePaise(' 105,50 ')).toBe(10_550);
    expect(parsePaise('.05')).toBe(5);
    expect(parsePaise('1000000000.01')).toBeUndefined();
    expect(parsePaise('10.005')).toBeUndefined();
    expect(parsePaise('0')).toBeUndefined();
    expect(parsePaise('0', true)).toBe(0);
  });

  it('stores a depleted holding and still requires positive income', () => {
    expect(holdingSchema.safeParse({ name: 'Savings', kind: 'Savings', amountPaise: 0, asOf: '2026-11-09' }).success).toBe(true);
    expect(incomeSchema.safeParse({ name: 'Salary', amountPaise: 0, date: '2026-11-09' }).success).toBe(false);
  });

  it('clamps recurring dates to the last day of shorter months', () => {
    const monthly: Bill = { id: 'rent', name: 'Rent', amountPaise: 500_000, dueDate: '2025-01-31', repeat: 'monthly' };
    const yearly: Bill = { ...monthly, dueDate: '2024-02-29', repeat: 'yearly' };
    expect(billDateInMonth(monthly, '2025-02')).toBe('2025-02-28');
    expect(billDateInMonth(monthly, '2024-12')).toBeUndefined();
    expect(billDateInMonth(yearly, '2025-02')).toBe('2025-02-28');
    expect(billDateInMonth(yearly, '2025-03')).toBeUndefined();
  });

  it('carries missed bills and treats deleted expenses as unpaid', () => {
    const bill: Bill = { id: 'rent', name: 'Rent', amountPaise: 500_000, dueDate: '2025-01-31', repeat: 'monthly' };
    const payment: BillPayment = { id: billPaymentKey(bill.id, bill.dueDate), expenseId: 'payment', dueDate: bill.dueDate };
    const expense: Expense = { id: payment.expenseId, amount: 5_000, category: 'Bills & Utilities', date: '2025-02-05', createdAt: '2025-02-05' };

    expect(listBillOccurrences([bill], [payment], [expense], '2025-01')[0].expense).toBeUndefined();
    const february = listBillOccurrences([bill], [payment], [expense], '2025-02');
    expect(february.map(({ dueDate }) => dueDate)).toEqual(['2025-01-31', '2025-02-28']);
    expect(february[0].expense).toEqual(expense);
    expect(listBillOccurrences([bill], [payment], [], '2025-02')[0].expense).toBeUndefined();
    expect(listBillOccurrences([{ ...bill, repeat: 'once' }], [], [], '2025-03').map(({ dueDate }) => dueDate)).toEqual(['2025-01-31']);
  });
});
