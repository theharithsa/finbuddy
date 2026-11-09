import type { Expense } from '@/lib/types';

export function localDate(date = new Date()): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function monthRange(month: string) {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + 1, 0);
  return {
    from: `${month}-01`,
    to: localDate(date),
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

export function spendingWindow(expenses: Expense[], month: string, today = localDate()) {
  const { from, to } = monthRange(month);
  const through = today < to ? today : to;
  const elapsedDays = through < from ? 0 : Number(through.slice(-2));
  const current = periodExpenses(expenses, from, through);
  const spent = totalAmount(current);
  const previousMonth = shiftMonth(month, -1);
  const comparisonDays = Math.min(elapsedDays, Number(monthRange(previousMonth).to.slice(-2)));
  const cutoff = String(comparisonDays).padStart(2, '0');
  const previous = periodExpenses(expenses, previousMonth + '-01', previousMonth + '-' + cutoff);
  const comparable = current.filter(({ date }) => date.slice(0, 10) <= month + '-' + cutoff);
  const differencePaise = Math.round(totalAmount(comparable) * 100) - Math.round(totalAmount(previous) * 100);
  return {
    current, spent, elapsedDays, from, to,
    comparison: previous.length > 0 ? { days: comparisonDays, difference: differencePaise / 100 } : undefined,
  };
}
