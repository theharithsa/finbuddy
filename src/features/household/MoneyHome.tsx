import { ArrowDownLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Landmark, Plus, Wallet } from '@/components/brand/Icons';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/brand/BrandMark';
import { formatDate } from '@/lib/types';
import { billPaymentKey, money, type BillOccurrence, type Holding, type Income } from '@/lib/household';
import type { Editor } from './HouseholdEditor';
import { MoneyRecordRow } from './MoneyRecordRow';

interface MoneyHomeProps {
  monthLabel: string;
  currentMonth: boolean;
  today: string;
  income: Income[];
  spentPaise: number;
  bills: BillOccurrence[];
  holdings: Holding[];
  onMonthChange: (direction: -1 | 1) => void;
  onEdit?: (editor: Editor) => void;
  onExpenses: () => void;
  onBills: () => void;
  onSavings: () => void;
}

function dueLabel(dueDate: string, today: string) {
  if (dueDate === today) return 'Due today';
  return (dueDate < today ? 'Overdue · ' : 'Due ') + formatDate(dueDate);
}

export function MoneyHome({ monthLabel, currentMonth, today, income, spentPaise, bills, holdings, onMonthChange, onEdit, onExpenses, onBills, onSavings }: MoneyHomeProps) {
  const earned = income.reduce((total, entry) => total + entry.amountPaise, 0);
  const due = bills.filter(({ expense }) => !expense);
  const billsPaise = due.reduce((total, { bill }) => total + bill.amountPaise, 0);
  const left = earned - spentPaise - billsPaise;
  const estimateCopy = !income.length
    ? 'Add income you’ve received to see what’s left.'
    : left < 0
      ? 'Logged expenses and unpaid bills are ahead of recorded income.'
      : 'An estimate based on what you’ve logged.';
  const savingsPaise = holdings.reduce((total, entry) => total + entry.amountPaise, 0);

  return (
    <>
      <header className="m3-page-heading money-home-heading">
        <div>
          <span className="m3-page-kicker"><span className="money-kicker-dot" /> Monthly check-in</span>
          <h1>Your money, in view.</h1>
          <p>See what came in, what went out, and what’s still on the calendar.</p>
        </div>
        <div className="money-period" role="group" aria-label="Summary month">
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => onMonthChange(-1)}><ChevronLeft size={19} /></Button>
          <span aria-live="polite">{monthLabel}</span>
          <Button variant="ghost" size="icon" aria-label="Next month" disabled={currentMonth} onClick={() => onMonthChange(1)}><ChevronRight size={19} /></Button>
        </div>
      </header>

      <section className="money-hero" aria-label="Monthly money summary">
        <div className="money-hero-balance">
          <span className="money-hero-label"><Wallet size={19} /> Left after bills</span>
          <strong className="money-hero-amount">{income.length ? money(left) : '—'}</strong>
          <p>{estimateCopy}</p>
          {onEdit && <Button className="money-hero-action" onClick={() => onEdit({ kind: 'income', defaultDate: currentMonth ? undefined : today })}><Plus size={18} /> Add income</Button>}
        </div>
        <div className="money-metrics">
          <span className="money-metrics-title">How it adds up</span>
          <div><span>Income received</span><strong>{money(earned)}</strong></div>
          <button type="button" onClick={onExpenses}><span>Expenses logged</span><strong>{money(spentPaise)}</strong><ChevronRight size={16} /></button>
          <button type="button" onClick={onBills}><span>Bills still due</span><strong>{money(billsPaise)}</strong><ChevronRight size={16} /></button>
        </div>
      </section>

      <div className="money-home-grid">
        <section className="money-home-bills" aria-labelledby="home-bills-heading">
          <header className="money-panel-heading">
            <span className="m3-row-icon"><CalendarDays size={22} /></span>
            <div><h2 id="home-bills-heading">Bills &amp; EMIs</h2><p>{due.length ? 'A look at the payments still to make.' : 'Keep rent, fees, and recurring payments on your radar.'}</p></div>
          </header>
          {due.length > 0 ? (
            <ul className="money-compact-list">
              {due.slice(0, 3).map(({ bill, dueDate }) => <li key={billPaymentKey(bill.id, dueDate)}>
                <div><strong>{bill.name}</strong><small className={dueDate < today ? 'money-overdue' : undefined}>{dueLabel(dueDate, today)}</small></div>
                <strong>{money(bill.amountPaise)}</strong>
              </li>)}
            </ul>
          ) : <p className="money-quiet money-home-empty">{bills.length ? 'You’re caught up on the bills shown for this month.' : 'No bills due on your list this month.'}</p>}
          <div className="money-panel-actions">
            <Button variant="secondary" onClick={onBills}>Manage bills <ArrowRight size={17} /></Button>
            {onEdit && <Button variant="ghost" onClick={() => onEdit({ kind: 'bills' })}>Add bill</Button>}
          </div>
        </section>

        <section className="money-savings-note" aria-labelledby="home-savings-heading">
          <div className="money-savings-title">
            <span className="m3-page-kicker"><Landmark size={15} /> Set aside</span>
            <h2 id="home-savings-heading">Savings &amp; investments</h2>
          </div>
          <div className="money-savings-body">
            <div>
              {holdings.length ? <div className="money-held"><strong>{money(savingsPaise)}</strong><small>Latest values from {holdings.length} {holdings.length === 1 ? 'entry' : 'entries'}</small></div>
                : <p className="money-quiet">Start with a balance you know. It could be an emergency fund, an FD, or a mutual fund.</p>}
            </div>
            <BrandMark className="money-savings-mark" />
          </div>
          <div className="money-panel-actions">
            {holdings.length
              ? <Button variant="secondary" onClick={onSavings}>Open savings <ArrowRight size={17} /></Button>
              : onEdit && <Button variant="secondary" onClick={() => onEdit({ kind: 'holdings' })}><Plus size={17} /> Add savings or investment</Button>}
          </div>
        </section>
      </div>

      {income.length > 0 && <details className="money-list-panel money-income-list">
        <summary><ArrowDownLeft size={19} /> Income this month <small>{income.length} {income.length === 1 ? 'entry' : 'entries'}</small><ChevronRight className="money-disclosure-arrow" size={17} /></summary>
        <ul className="money-record-list">
          {income.map((entry) => <li key={entry.id}>
            <MoneyRecordRow title={entry.name} description={formatDate(entry.date)} amount={money(entry.amountPaise)}
              editLabel={`Edit income: ${entry.name}`} onEdit={onEdit ? () => onEdit({ kind: 'income', entry }) : undefined} />
          </li>)}
        </ul>
      </details>}
    </>
  );
}
