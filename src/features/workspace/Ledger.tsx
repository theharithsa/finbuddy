import { useMemo, useState } from 'react';
import { LayoutGrid, List, ReceiptText, Search } from 'lucide-react';
import { ExpenseCard } from '@/components/ExpenseCard';
import { TimeframePicker, type DateRange } from '@/components/TimeframePicker';
import { formatCurrency, type Expense, type Person } from '@/lib/types';
import { periodExpenses, totalAmount } from '@/lib/finance-period';

interface LedgerProps {
  expenses: Expense[];
  people: Person[];
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => Promise<void>;
}

export function Ledger({ expenses, people, range, onRangeChange, onEdit, onDelete }: LedgerProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [person, setPerson] = useState('');
  const [sort, setSort] = useState('date');
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [visible, setVisible] = useState(30);
  const categoryNames = [...new Set(expenses.map((expense) => expense.category).filter(Boolean))].sort();
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return periodExpenses(expenses, range.from, range.to).filter((expense) => {
      return (!term || [expense.description, expense.category, expense.app].some((value) => value?.toLowerCase().includes(term))) &&
        (!category || expense.category === category) &&
        (!person || expense.peopleIds?.includes(person));
    }).sort((a, b) => {
      if (sort === 'amount') return b.amount - a.amount;
      if (sort === 'category') return a.category.localeCompare(b.category);
      return b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [expenses, range, search, category, person, sort]);

  return (
    <>
      <div className="fb-page-heading"><div><p className="fb-kicker">YOUR LEDGER</p><h1>Expenses</h1><p>Find, review and edit your transactions.</p></div></div>
      <section className="fb-panel">
        <div className="fb-ledger-filters">
          <label className="fb-search"><Search size={17} /><input type="search" placeholder="Search expenses" aria-label="Search expenses" value={search} onChange={(event) => { setSearch(event.target.value); setVisible(30); }} /></label>
          <TimeframePicker dateRange={range} onDateRangeChange={(next) => { onRangeChange(next); setVisible(30); }} />
          <select aria-label="Filter by category" value={category} onChange={(event) => { setCategory(event.target.value); setVisible(30); }}><option value="">All categories</option>{categoryNames.map((name) => <option key={name}>{name}</option>)}</select>
          <select aria-label="Filter by person" value={person} onChange={(event) => { setPerson(event.target.value); setVisible(30); }}><option value="">All people</option>{people.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}</select>
          <select aria-label="Sort expenses" value={sort} onChange={(event) => { setSort(event.target.value); setVisible(30); }}><option value="date">Newest first</option><option value="amount">Highest amount</option><option value="category">Category</option></select>
        </div>
        <div className="fb-ledger-total">
          <span aria-live="polite"><strong>{formatCurrency(totalAmount(filtered))}</strong> · {filtered.length} {filtered.length === 1 ? 'expense' : 'expenses'}</span>
          <div className="fb-view-toggle" aria-label="Expense layout">
            <button aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17} /></button>
            <button aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={17} /></button>
          </div>
        </div>
        {filtered.length === 0 ? <div className="fb-empty"><ReceiptText size={25} /><h2>No matching expenses</h2><p>Try a different date range or filter.</p></div> : (
          <div className={view === 'grid' ? 'fb-ledger-grid' : 'fb-ledger-list'}>
            {filtered.slice(0, visible).map((expense) => <ExpenseCard key={expense.id} expense={expense} viewMode={view} customPeople={people} onEdit={() => onEdit(expense)} onDelete={() => onDelete(expense)} />)}
          </div>
        )}
        {filtered.length > visible && <button className="fb-button fb-secondary fb-more" onClick={() => setVisible(visible + 30)}>Show more expenses</button>}
      </section>
    </>
  );
}
