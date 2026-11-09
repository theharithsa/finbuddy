import { ArrowDownRight, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, CircleGauge, ReceiptText, Wallet } from 'lucide-react';
import { formatCurrency, formatDate, type Budget, type Category, type Expense } from '@/lib/types';
import { monthRange, periodExpenses, shiftMonth, totalAmount } from '@/lib/finance-period';

interface OverviewProps {
  expenses: Expense[];
  budgets: Budget[];
  categories: Category[];
  month: string;
  onMonthChange: (month: string) => void;
  onOpenLedger: () => void;
  onOpenBudgets: () => void;
  onAddExpense: () => void;
}

const colors = ['#087d71', '#7761ae', '#c27543', '#5376a5', '#a95c79'];

export function Overview({ expenses, budgets, categories, month, onMonthChange, onOpenLedger, onOpenBudgets, onAddExpense }: OverviewProps) {
  const { from, to } = monthRange(month);
  const current = periodExpenses(expenses, from, to);
  const spent = totalAmount(current);
  const cap = budgets.reduce((total, budget) => total + Math.round(budget.limit * 100), 0) / 100;
  const budgetCategories = new Set(budgets.map((budget) => budget.category));
  const budgetedSpend = totalAmount(current.filter((expense) => budgetCategories.has(expense.category)));
  const remaining = cap - budgetedSpend;
  const categoryAmounts = new Map<string, number>();
  for (const expense of current) {
    categoryAmounts.set(expense.category, (categoryAmounts.get(expense.category) ?? 0) + Math.round(expense.amount * 100));
  }
  const leaders = [...categoryAmounts].sort(([, a], [, b]) => b - a).slice(0, 5);
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
      <div className="fb-page-heading">
        <div><p className="fb-kicker">YOUR MONEY, IN FOCUS</p><h1>Overview</h1><p>See what you spent and how it fits your plan.</p></div>
        <div className="fb-month" aria-label="Overview month">
          <button type="button" aria-label="Previous month" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>
          <span aria-live="polite"><CalendarDays size={15} />{monthLabel}</span>
          <button type="button" aria-label="Next month" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="fb-stats">
        <article className="fb-stat fb-stat-accent"><ArrowDownRight size={19} /><span>Total spent</span><strong>{formatCurrency(spent)}</strong><small>All expenses this month</small></article>
        <article className="fb-stat"><Wallet size={19} /><span>Monthly budget</span><strong>{cap > 0 ? formatCurrency(cap) : '—'}</strong><button className="fb-text-button" onClick={onOpenBudgets}>{cap > 0 ? 'Manage limits' : 'Set your budget'} <ArrowRight size={13} /></button></article>
        <article className="fb-stat"><CircleGauge size={19} /><span>{cap > 0 && remaining < 0 ? 'Over budget' : 'Budget remaining'}</span><strong>{cap > 0 ? formatCurrency(Math.abs(remaining)) : '—'}</strong><small>Budgeted categories only</small></article>
      </div>

      <div className="fb-insight-grid">
        <section className="fb-panel" aria-labelledby="spending-pace">
          <div className="fb-section-heading"><div><h2 id="spending-pace">Spending pace</h2><p>Totals by day range</p></div><span className="fb-pill">INR</span></div>
          <div className="fb-chart">
            {weeks.map(({ label, value }) => (
              <div className="fb-chart-column" key={label}>
                <span className="fb-chart-value">{formatCurrency(value)}</span>
                <div className="fb-chart-track"><div style={{ height: `${Math.max(0, value / peak) * 100}%` }} /></div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="fb-panel" aria-labelledby="top-categories">
          <div className="fb-section-heading"><div><h2 id="top-categories">Where it went</h2><p>Top spending categories</p></div></div>
          {leaders.length > 0 ? (
            <ul className="fb-category-list">
              {leaders.map(([name, minorAmount], index) => (
                <li key={name}>
                  <div><span>{name || 'Uncategorised'}</span><strong>{formatCurrency(minorAmount / 100)}</strong></div>
                  <div className="fb-category-track" aria-hidden="true"><span style={{ width: `${spent > 0 ? Math.min(100, Math.max(0, minorAmount / (spent * 100) * 100)) : 0}%`, background: colors[index] }} /></div>
                </li>
              ))}
            </ul>
          ) : <p className="fb-empty-copy">Category totals will appear after you log an expense.</p>}
        </section>
      </div>

      <section className="fb-panel" aria-labelledby="recent-expenses">
        <div className="fb-section-heading"><div><h2 id="recent-expenses">Recent expenses</h2><p>{monthLabel}</p></div><button className="fb-text-button" onClick={onOpenLedger}>View expenses <ArrowRight size={15} /></button></div>
        {recent.length > 0 ? <ul className="fb-recent">
          {recent.map((expense) => (
            <li key={expense.id}>
              <span className="fb-expense-icon" aria-hidden="true">{categories.find(({ name }) => name === expense.category)?.icon ?? <ReceiptText size={18} />}</span>
              <span className="fb-expense-title"><strong>{expense.description || expense.category || 'Expense'}</strong><small>{expense.category || 'Uncategorised'} · {formatDate(expense.date)}</small></span>
              <strong>{formatCurrency(expense.amount)}</strong>
            </li>
          ))}
        </ul> : <div className="fb-empty"><ReceiptText size={25} /><h3>No expenses this month</h3><p>Log a purchase to start seeing where your money goes.</p><button className="fb-button fb-secondary" onClick={onAddExpense}>Add an expense</button></div>}
      </section>
    </>
  );
}
