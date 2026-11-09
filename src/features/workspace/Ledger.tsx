import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ReceiptText, Search, SlidersHorizontal, X } from '@/components/brand/Icons';
import { ExpenseCard } from '@/components/ExpenseCard';
import { ALL_DATES, TimeframePicker, type DateRange } from '@/components/TimeframePicker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatCurrency, formatDate, type Category, type Expense, type Person } from '@/lib/types';
import { localDate, monthRange, periodExpenses, shiftMonth, totalAmount } from '@/lib/finance-period';

interface LedgerProps {
  expenses: Expense[];
  categories: Category[];
  people: Pick<Person, 'id' | 'name'>[];
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onEdit?: (expense: Expense) => void;
  onDelete?: (expense: Expense) => void;
  onAdd?: () => void;
}

interface Filters {
  category: string;
  person: string;
  sort: 'date' | 'amount' | 'category';
}

const defaults: Filters = { category: '', person: '', sort: 'date' };

export function Ledger({ expenses, categories, people, range, onRangeChange, onEdit, onDelete, onAdd }: LedgerProps) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(defaults);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visible, setVisible] = useState(30);
  const month = range.from.slice(0, 7);
  const allTime = range.from === ALL_DATES.from && range.to === ALL_DATES.to;
  const fullMonth = !allTime && range.from === monthRange(month).from && range.to === monthRange(month).to;
  const periodLabel = allTime ? "All time" : fullMonth
    ? new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(`${range.from}T12:00:00`))
    : `${formatDate(range.from)} – ${formatDate(range.to)}`;
  const filterCount = Number(Boolean(filters.category)) + Number(Boolean(filters.person)) + Number(filters.sort !== 'date');
  const categoryNames = [...new Set(expenses.map(({ category }) => category).filter(Boolean))].sort();
  const period = useMemo(() => periodExpenses(expenses, range.from, range.to), [expenses, range]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return period.filter((expense) =>
      (!term || [expense.description, expense.category, expense.app].some((value) => value?.toLowerCase().includes(term))) &&
      (!filters.category || expense.category === filters.category) &&
      (!filters.person || expense.peopleIds?.includes(filters.person)),
    ).sort((a, b) => {
      if (filters.sort === 'amount') return b.amount - a.amount;
      if (filters.sort === 'category') return a.category.localeCompare(b.category);
      return b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [period, search, filters]);

  const groups = new Map<string, Expense[]>();
  for (const expense of filtered.slice(0, visible)) {
    const key = filters.sort === 'date' ? expense.date.slice(0, 10) : '';
    const group = groups.get(key) ?? [];
    group.push(expense);
    groups.set(key, group);
  }

  function changeRange(next: DateRange) {
    setVisible(30);
    onRangeChange(next);
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setVisible(30);
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  function clearFilters() {
    setFilters(defaults);
    setSearch('');
    setVisible(30);
  }

  return (
    <>
      <header className="m3-page-heading">
        <div><span className="m3-page-kicker">Everyday money</span><h1>Expenses</h1><p>See where it went, one day at a time.</p></div>
        {fullMonth ? <div className="m3-month-control" role="group" aria-label="Expense period">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => changeRange(monthRange(shiftMonth(month, -1)))}><ChevronLeft size={20} /></Button>
          <span aria-live="polite"><CalendarDays size={17} />{periodLabel}</span>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => changeRange(monthRange(shiftMonth(month, 1)))}><ChevronRight size={20} /></Button>
        </div> : <div className="m3-period-label"><CalendarDays size={17} /><span>{periodLabel}</span><Button variant="ghost" size="sm" onClick={() => changeRange(monthRange(localDate().slice(0, 7)))}>This month</Button></div>}
      </header>

      <section className="m3-ledger-summary" aria-label="Spending summary">
        <span className="m3-summary-icon"><ReceiptText size={24} /></span>
        <div><span>Spent in this period</span><strong>{formatCurrency(totalAmount(period))}</strong></div>
        <span className="m3-summary-count">{period.length} {period.length === 1 ? 'expense' : 'expenses'}</span>
      </section>

      <section className="m3-ledger" aria-label="Expense history">
        <div className="m3-ledger-toolbar">
          <label className="m3-search">
            <Search size={20} aria-hidden="true" />
            <input type="search" placeholder="Search expenses" aria-label="Search expenses" value={search} onChange={(event) => { setSearch(event.target.value); setVisible(30); }} />
          </label>
          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <DialogTrigger asChild><Button variant={filterCount ? 'secondary' : 'outline'}><SlidersHorizontal size={18} />Filters{filterCount > 0 && ` (${filterCount})`}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Filter expenses</DialogTitle><DialogDescription>Set a date range, narrow the list or change the order.</DialogDescription></DialogHeader>
              <div className="m3-filter-fields">
                <TimeframePicker dateRange={range} onDateRangeChange={changeRange} />
                <label className="m3-field"><span>Category</span><select value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}><option value="">All categories</option>{categoryNames.map((name) => <option key={name}>{name}</option>)}</select></label>
                <label className="m3-field"><span>Person</span><select value={filters.person} onChange={(event) => updateFilter('person', event.target.value)}><option value="">All people</option>{people.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select></label>
                <label className="m3-field"><span>Sort by</span><select value={filters.sort} onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'date' || value === 'amount' || value === 'category') updateFilter('sort', value);
                }}><option value="date">Newest first</option><option value="amount">Highest amount</option><option value="category">Category</option></select></label>
              </div>
              <div className="m3-expense-actions"><Button variant="ghost" onClick={() => { clearFilters(); changeRange(monthRange(localDate().slice(0, 7))); }}>Reset filters</Button><Button onClick={() => setFilterOpen(false)}>Done</Button></div>
            </DialogContent>
          </Dialog>
        </div>

        {(filterCount > 0 || search) && <div className="m3-filter-summary">
          <span aria-live="polite">{filtered.length} {filtered.length === 1 ? 'match' : 'matches'} · {formatCurrency(totalAmount(filtered))}</span>
          <button type="button" className="m3-chip" onClick={clearFilters}><X size={15} />Clear filters</button>
        </div>}

        {filtered.length === 0 ? <div className="m3-empty">
          <span className="m3-row-icon"><ReceiptText size={24} /></span>
          <h2>{period.length > 0 ? 'No matching expenses' : 'No expenses in this period'}</h2>
          <p>{period.length > 0 ? 'Try another search or clear the filters.' : 'A grocery run, a ride home, or a cup of chai. Start with something you remember.'}</p>
          {period.length === 0 && onAdd && <Button variant="secondary" onClick={onAdd}>Log your first expense</Button>}
        </div> : [...groups].map(([date, group]) => (
          <div className="m3-expense-group" key={date}>
            {date && <h2>{formatDate(date)}</h2>}
            <ul>{group.map((expense) => <ExpenseCard key={expense.id} expense={expense} categories={categories} people={people}
              onEdit={onEdit ? () => onEdit(expense) : undefined} onDelete={onDelete ? () => onDelete(expense) : undefined} />)}</ul>
          </div>
        ))}
        {filtered.length > visible && <Button variant="ghost" className="m3-load-more" onClick={() => setVisible(visible + 30)}>Show more expenses</Button>}
      </section>
    </>
  );
}
