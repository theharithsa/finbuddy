import { describe, expect, it } from 'vitest';
import { localDate, monthRange, periodExpenses, shiftMonth, spendingWindow, totalAmount } from '@/lib/finance-period';
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

  it('compares the same elapsed days and excludes future-dated entries', () => {
    const result = spendingWindow([
      expense('2026-02-20', 90.1),
      expense('2026-03-20', 100.1),
      expense('2026-03-29', 500),
      expense('2026-03-31', 900),
    ], '2026-03', '2026-03-30');
    expect(result.elapsedDays).toBe(30);
    expect(result.spent).toBe(600.1);
    expect(result.comparison).toEqual({ days: 28, difference: 10 });
    expect(spendingWindow([], '2026-04', '2026-03-30').elapsedDays).toBe(0);
  });
});
