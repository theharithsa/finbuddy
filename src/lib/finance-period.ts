import type { Expense } from '@/lib/types';

export function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function monthRange(month: string) {
  const date = new Date(`${month}-01T12:00:00`);
  return {
    from: `${month}-01`,
    to: localDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

export function shiftMonth(month: string, direction: number): string {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + direction);
  return localDate(date).slice(0, 7);
}

export function periodExpenses(expenses: Expense[], from: string, to: string): Expense[] {
  return expenses.filter(({ date }) => date.slice(0, 10) >= from && date.slice(0, 10) <= to);
}

export function totalAmount(expenses: Expense[]): number {
  return expenses.reduce((total, { amount }) => total + Math.round(amount * 100), 0) / 100;
}
