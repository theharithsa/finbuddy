import { describe, expect, it } from 'vitest';
import { localDate, monthRange, periodExpenses, shiftMonth, totalAmount } from '@/lib/finance-period';
import type { Expense } from '@/lib/types';

function expense(date: string, amount: number): Expense {
  return { id: date, date, amount, description: 'Synthetic', category: 'Other', createdAt: date };
}

describe('workspace date and amount calculations', () => {
  it('uses local dates and includes the whole leap month', () => {
    expect(localDate(new Date(2024, 1, 1, 0, 1))).toBe('2024-02-01');
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(shiftMonth('2024-01', -1)).toBe('2023-12');
  });

  it('includes legacy timestamps on the last day and totals in paise', () => {
    const selected = periodExpenses([
      expense('2024-02-01', 0.1),
      expense('2024-02-29T23:00:00.000Z', 0.2),
      expense('2024-03-01', 1),
    ], '2024-02-01', '2024-02-29');
    expect(selected).toHaveLength(2);
    expect(totalAmount(selected)).toBe(0.3);
  });
});
