import { ArrowDownLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Landmark, Plus, Wallet } from '@/components/brand/Icons';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/types';
import { billPaymentKey, money, type BillOccurrence, type Holding, type Income } from '@/lib/household';
import type { Editor } from './HouseholdEditor';

interface MoneyHomeProps {
  monthLabel: string;
  currentMonth: boolean;
  today: string;
  income: Income[];
  spentPaise: number;
  bills: BillOccurrence[];
  holdings: Holding[];
  onMonthChange: (direction: -1 | 1) => void;
  onEdit: (editor: Editor) => void;
  onExpenses: () => void;
  onBills: () => void;
  onSavings: () => void;
}

export function MoneyHome({ monthLabel, currentMonth, today, income, spentPaise, bills, holdings, onMonthChange, onEdit, onExpenses, onBills, onSavings }: MoneyHomeProps) {
  const earned = income.reduce((total, entry) => total + entry.amountPaise, 0);
  const due = bills.filter(({ expense }) => !expense);
  const billsPaise = due.reduce((total, { bill }) => total + bill.amountPaise, 0);
  const savingsPaise = holdings.reduce((total, entry) => total + entry.amountPaise, 0);

  return (
    <>
      <header className="m3-page-heading">
        <div><h1>Home</h1><p>See what came in, what went out, and what’s still due.</p></div>
        <div className="money-period" role="group" aria-label="Summary month">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => onMonthChange(-1)}><ChevronLeft size={19} /></Button>
          <span aria-live="polite">{monthLabel}</span>
          <Button variant="ghost" size="icon" aria-label="Next month" disabled={currentMonth} onClick={() => onMonthChange(1)}><ChevronRight size={19} /></Button>
        </div>
      </header>
      <section className="money-hero" aria-label="Monthly money summary">
        <div className="money-hero-top">
          <div>
            <span><Wallet size={18} /> Left after bills</span>
            <strong>{income.length ? money(earned - spentPaise - billsPaise) : '—'}</strong>
            <p>{income.length ? 'Income received minus expenses logged and bills still due.' : 'Add income you’ve received to see what’s left.'}</p>
          </div>
          <Button onClick={() => onEdit({ kind: 'income', defaultDate: currentMonth ? undefined : today })}><Plus size={18} /> Add income</Button>
        </div>
        <div className="money-metrics">
          <div><span>Income received</span><strong>{money(earned)}</strong></div>
          <button type="button" onClick={onExpenses}><span>Expenses logged <ChevronRight size={14} /></span><strong>{money(spentPaise)}</strong></button>
          <button type="button" onClick={onBills}><span>Bills still due <ChevronRight size={14} /></span><strong>{money(billsPaise)}</strong></button>
        </div>
      </section>

      <div className="money-home-grid">
        <section className="m3-panel money-panel">
          <header className="money-panel-heading">
            <span className="m3-row-icon"><CalendarDays size={21} /></span>
            <div><h2>Bills &amp; EMIs</h2><p>Rent, school fees, utilities and loan payments.</p></div>
          </header>
          {due.length ? (
            <ul className="money-compact-list">
              {due.slice(0, 3).map(({ bill, dueDate }) => <li key={billPaymentKey(bill.id, dueDate)}>
                <div><strong>{bill.name}</strong><small>{dueDate < today ? 'Overdue · ' : 'Due '}{formatDate(dueDate)}</small></div>
                <strong>{money(bill.amountPaise)}</strong>
              </li>)}
            </ul>
          ) : <p className="money-quiet">No unpaid bills on your list this month.</p>}
          <div className="money-panel-actions">
            <Button variant="secondary" onClick={onBills}>Manage bills <ArrowRight size={17} /></Button>
            <Button variant="ghost" onClick={() => onEdit({ kind: 'bills' })}>Add bill</Button>
          </div>
        </section>

        <section className="m3-panel money-panel">
          <header className="money-panel-heading">
            <span className="m3-row-icon"><Landmark size={21} /></span>
            <div><h2>Savings &amp; investments</h2><p>Keep the latest values in one place.</p></div>
          </header>
          {holdings.length ? <div className="money-held"><strong>{money(savingsPaise)}</strong><small>Recorded value across {holdings.length} {holdings.length === 1 ? 'entry' : 'entries'}</small></div>
            : <p className="money-quiet">Start with any balance you know, such as emergency savings, an FD, or a mutual fund.</p>}
          <div className="money-panel-actions">
            {holdings.length
              ? <Button variant="secondary" onClick={onSavings}>Open savings <ArrowRight size={17} /></Button>
              : <Button variant="secondary" onClick={() => onEdit({ kind: 'holdings' })}><Plus size={17} /> Add savings or investment</Button>}
          </div>
        </section>
      </div>

      {income.length > 0 && <details className="m3-panel money-list-panel">
        <summary><ArrowDownLeft size={19} /> Income this month <small>{income.length} {income.length === 1 ? 'entry' : 'entries'}</small></summary>
        <ul className="money-record-list">
          {income.map((entry) => <li key={entry.id}>
            <button type="button" aria-label={`Edit income: ${entry.name}`} onClick={() => onEdit({ kind: 'income', entry })}>
              <span><strong>{entry.name}</strong><small>{formatDate(entry.date)}</small></span>
              <strong>{money(entry.amountPaise)}</strong><ChevronRight size={18} />
            </button>
          </li>)}
        </ul>
      </details>}
    </>
  );
}
