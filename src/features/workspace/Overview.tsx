import { ItemIcon } from '@/components/brand/ItemIcon';
import { Button } from '@/components/ui/button';
import { ArrowDownRight, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, CircleGauge, Clock, ReceiptText, Tag, TrendingUp, Wallet } from '@/components/brand/Icons';
import { formatCurrency, formatDate, type Budget, type Category, type Expense } from '@/lib/types';
import { shiftMonth, spendingWindow, totalAmount } from '@/lib/finance-period';
import type { ReactNode } from 'react';

interface OverviewProps {
  expenses: Expense[];
  budgets: Budget[];
  categories: Category[];
  month: string;
  onMonthChange: (month: string) => void;
  onOpenLedger: () => void;
  onOpenBudgets?: () => void;
  onAddExpense?: () => void;
}

function InsightTile({ icon, title, value, detail }: { icon: ReactNode; title: string; value: string; detail: string }) {
  return <article className="m3-stat m3-insight-tile">{icon}<span>{title}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export function Overview({ expenses, budgets, categories, month, onMonthChange, onOpenLedger, onOpenBudgets, onAddExpense }: OverviewProps) {
  const { from, to, current, spent, elapsedDays, comparison } = spendingWindow(expenses, month);
  const cap = budgets.reduce((total, budget) => total + Math.round(budget.limit * 100), 0) / 100;
  const budgetCategories = new Set(budgets.map((budget) => budget.category));
  const budgetedSpend = totalAmount(current.filter((expense) => budgetCategories.has(expense.category)));
  const remaining = cap - budgetedSpend;
  const categoryAmounts = new Map<string, number>();
  for (const expense of current) {
    categoryAmounts.set(expense.category, (categoryAmounts.get(expense.category) ?? 0) + Math.round(expense.amount * 100));
  }
  const leaders = [...categoryAmounts].sort(([, a], [, b]) => b - a).slice(0, 5);
  const topCategory = leaders[0];
  const largest = current.reduce<Expense | undefined>((best, entry) => !best || entry.amount > best.amount ? entry : best, undefined);
  const recent = [...current].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);
  const days = Number(to.slice(-2));
  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, index) => {
    const first = index * 7 + 1;
    const last = Math.min(first + 6, days);
    const value = totalAmount(current.filter(({ date }) => {
      const day = Number(date.slice(8, 10));
      return day >= first && day <= last;
    }));
    return { label: `${first}–${last}`, value };
  });
  const peak = Math.max(1, ...weeks.map(({ value }) => value));
  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(`${from}T12:00:00`));

  return (
    <>
      <div className="m3-page-heading">
        <div><h1>Overview</h1><p>See what you spent and how it fits your plan.</p></div>
        <div className="m3-month-control" aria-label="Overview month">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft size={20} /></Button>
          <span aria-live="polite"><CalendarDays size={15} />{monthLabel}</span>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight size={20} /></Button>
        </div>
      </div>

      <div className="m3-overview-stats">
        <article className="m3-stat m3-stat-highlight"><ArrowDownRight size={19} /><span>Total spent</span><strong>{formatCurrency(spent)}</strong><small>All expenses this month</small></article>
        <article className="m3-stat"><Wallet size={19} /><span>Monthly budget</span><strong>{cap > 0 ? formatCurrency(cap) : '—'}</strong>{onOpenBudgets && <button className="m3-inline-action" onClick={onOpenBudgets}>{cap > 0 ? 'Manage limits' : 'Set your budget'} <ArrowRight size={13} /></button>}</article>
        <article className="m3-stat m3-stat-tertiary"><CircleGauge size={19} /><span>{cap > 0 && remaining < 0 ? 'Over budget' : 'Budget remaining'}</span><strong>{cap > 0 ? formatCurrency(Math.abs(remaining)) : '—'}</strong><small>Budgeted categories only</small></article>
      </div>

      <section aria-labelledby="spending-insights">
        <div className="m3-section-heading"><div><h2 id="spending-insights">Spending insights</h2><p>A few details behind the month’s total.</p></div></div>
        <div className="m3-insight-grid">
          <InsightTile icon={<Clock size={19} />} title="Daily average"
            value={elapsedDays ? formatCurrency(spent / elapsedDays) : '—'}
            detail={elapsedDays ? `Across ${elapsedDays} calendar ${elapsedDays === 1 ? 'day' : 'days'}` : 'This month hasn’t started'} />
          <InsightTile icon={<ReceiptText size={19} />} title="Largest expense"
            value={largest ? formatCurrency(largest.amount) : '—'}
            detail={largest ? largest.description || largest.category || 'Expense' : 'No expenses logged'} />
          <InsightTile icon={<Tag size={19} />} title="Top category"
            value={topCategory ? topCategory[0] || 'Uncategorised' : '—'}
            detail={topCategory ? formatCurrency(topCategory[1] / 100) + ' spent' : 'No expenses logged'} />
          <InsightTile icon={<TrendingUp size={19} />} title="Compared with last month"
            value={comparison ? formatCurrency(Math.abs(comparison.difference)) : '—'}
            detail={comparison
              ? `${comparison.difference > 0 ? 'More' : comparison.difference < 0 ? 'Less' : 'Same spending'} through day ${comparison.days} of both months`
              : 'No earlier expenses to compare'} />
        </div>
      </section>

      <div className="m3-overview-grid">
        <section className="m3-panel" aria-labelledby="spending-pace">
          <div className="m3-section-heading"><div><h2 id="spending-pace">Spending pace</h2><p>Totals by day range</p></div><span className="m3-chip">INR</span></div>
          <div className="m3-chart">
            {weeks.map(({ label, value }) => (
              <div className="m3-chart-column" key={label}>
                <span className="m3-chart-value">{formatCurrency(value)}</span>
                <div className="m3-chart-track"><div style={{ height: `${Math.max(0, value / peak) * 100}%` }} /></div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="m3-panel" aria-labelledby="top-categories">
          <div className="m3-section-heading"><div><h2 id="top-categories">Where it went</h2><p>Top spending categories</p></div></div>
          {leaders.length > 0 ? (
            <ul className="m3-category-list">
              {leaders.map(([name, minorAmount]) => (
                <li key={name}>
                  <div><span>{name || 'Uncategorised'}</span><strong>{formatCurrency(minorAmount / 100)}</strong></div>
                  <div className="m3-category-track" aria-hidden="true"><span style={{ width: `${spent > 0 ? Math.min(100, Math.max(0, minorAmount / (spent * 100) * 100)) : 0}%` }} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="m3-empty-copy">Category totals will appear after you log an expense.</p>}
        </section>
      </div>

      <section className="m3-panel" aria-labelledby="recent-expenses">
        <div className="m3-section-heading"><div><h2 id="recent-expenses">Recent expenses</h2><p>{monthLabel}</p></div><button className="m3-inline-action" onClick={onOpenLedger}>View expenses <ArrowRight size={15} /></button></div>
        {recent.length > 0 ? <ul className="m3-recent">
          {recent.map((expense) => (
            <li key={expense.id}>
              <span className="m3-row-icon" aria-hidden="true"><ItemIcon value={categories.find(({ name }) => name === expense.category)?.icon} size={18} /></span>
              <span className="m3-row-label"><strong>{expense.description && expense.description !== 'No description' ? expense.description : expense.category || 'Expense'}</strong><small>{expense.category || 'Uncategorised'} · {formatDate(expense.date)}</small></span>
              <strong>{formatCurrency(expense.amount)}</strong>
            </li>
          ))}
        </ul> : <div className="m3-empty"><ReceiptText size={25} /><h3>No expenses this month</h3><p>Log a purchase to start seeing where your money goes.</p>{onAddExpense && <button className="m3-inline-action" onClick={onAddExpense}>Add an expense</button>}</div>}
      </section>
    </>
  );
}
