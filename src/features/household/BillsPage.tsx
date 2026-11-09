import { CalendarDays, Check, Pencil, Plus } from '@/components/brand/Icons';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/types';
import { billPaymentKey, money, type Bill, type BillOccurrence } from '@/lib/household';
import type { Editor } from './HouseholdEditor';

const repeatLabel = { once: 'One time', monthly: 'Monthly', yearly: 'Yearly' };

interface BillsPageProps {
  bills: Bill[];
  occurrences: BillOccurrence[];
  today: string;
  onEdit: (editor: Editor) => void;
  onPay: (occurrence: BillOccurrence) => void;
}

export function BillsPage({ bills, occurrences, today, onEdit, onPay }: BillsPageProps) {
  const unpaid = occurrences.filter(({ expense }) => !expense);
  const paid = occurrences.filter(({ expense }) => Boolean(expense));
  const visible = new Set(occurrences.map(({ bill }) => bill.id));
  const other = bills.filter(({ id }) => !visible.has(id)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  function billRow({ bill, dueDate, expense }: BillOccurrence) {
    return (
      <li className="money-bill-row" key={billPaymentKey(bill.id, dueDate)}>
        <div className="money-bill-label">
          <strong>{bill.name}</strong>
          <small>{formatDate(dueDate)} · {repeatLabel[bill.repeat]}{!expense && dueDate < today ? ' · Overdue' : ''}</small>
        </div>
        <strong>{expense ? formatCurrency(expense.amount) : money(bill.amountPaise)}</strong>
        <div className="money-bill-actions">
          {expense ? <span className="money-paid"><Check size={15} /> Paid</span> : <Button variant="secondary" onClick={() => onPay({ bill, dueDate })}>Record payment</Button>}
          <Button variant="ghost" size="icon" aria-label={`Edit bill: ${bill.name}`} onClick={() => onEdit({ kind: 'bills', entry: bill })}><Pencil size={18} /></Button>
        </div>
      </li>
    );
  }

  return (
    <>
      <header className="m3-page-heading">
        <div><span className="m3-page-kicker">On the calendar</span><h1>Bills &amp; EMIs</h1><p>See what’s coming up and mark each bill as you pay it.</p></div>
        <Button onClick={() => onEdit({ kind: 'bills' })}><Plus size={18} /> Add bill</Button>
      </header>

      <section className="money-page-list">
        <header className="money-panel-heading">
          <span className="m3-row-icon"><CalendarDays size={21} /></span>
          <div><h2>Still to pay</h2><p>{unpaid.length ? money(unpaid.reduce((sum, { bill }) => sum + bill.amountPaise, 0)) + ' expected' : 'You’re caught up on the bills shown here.'}</p></div>
        </header>
        {unpaid.length > 0 && <ul className="money-bill-list">{unpaid.map(billRow)}</ul>}
        {!bills.length && <p className="money-quiet">Start with a bill you know is coming. Rent, electricity, or an EMI are good places to begin.</p>}
      </section>
      {paid.length > 0 && <details className="money-page-list money-list-panel">
        <summary><Check size={19} /> Paid <small>{paid.length}</small></summary>
        <ul className="money-bill-list">{paid.map(billRow)}</ul>
      </details>}
      {other.length > 0 && <details className="money-page-list money-list-panel">
        <summary><CalendarDays size={19} /> Other bill schedules <small>{other.length}</small></summary>
        <ul className="money-record-list">{other.map((bill) => <li key={bill.id}>
          <button type="button" aria-label={`Edit bill: ${bill.name}`} onClick={() => onEdit({ kind: 'bills', entry: bill })}>
            <span><strong>{bill.name}</strong><small>{repeatLabel[bill.repeat]} · First due {formatDate(bill.dueDate)}</small></span>
            <strong>{money(bill.amountPaise)}</strong><Pencil size={17} />
          </button>
        </li>)}</ul>
      </details>}
    </>
  );
}
