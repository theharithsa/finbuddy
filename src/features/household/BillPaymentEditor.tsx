import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { localDate } from '@/lib/finance-period';
import { recordBillPayment } from '@/lib/household-firestore';
import { parsePaise, type BillOccurrence } from '@/lib/household';
import { formatCurrency, formatDate, type Expense } from '@/lib/types';
import { AmountField, EntryError, RecordDialog, textValue } from './RecordDialog';

interface BillPaymentEditorProps {
  uid: string;
  occurrence: BillOccurrence;
  expenses: Expense[];
  onClose: () => void;
}

export function BillPaymentEditor({ uid, occurrence, expenses, onClose }: BillPaymentEditorProps) {
  const [link, setLink] = useState(false);
  const today = localDate();
  const { bill, dueDate } = occurrence;
  const candidates = expenses.filter((expense) =>
    !expense.billPaymentKey && expense.date.slice(0, 10) <= today,
  ).sort((a, b) => {
    const aMatches = Number(Math.round(a.amount * 100) === bill.amountPaise);
    const bMatches = Number(Math.round(b.amount * 100) === bill.amountPaise);
    return bMatches - aMatches || b.date.localeCompare(a.date);
  });

  async function save(values: FormData) {
    let input: Parameters<typeof recordBillPayment>[3];
    if (link) {
      const expenseId = textValue(values, 'expense');
      if (!candidates.some(({ id }) => id === expenseId)) throw new EntryError('Choose the expense you already logged.');
      input = { expenseId };
    } else {
      const amountPaise = parsePaise(values.get('amount'));
      const date = textValue(values, 'date') || today;
      if (amountPaise === undefined || date > today) throw new EntryError('Enter the amount paid and choose a date up to today.');
      input = { amountPaise, date };
    }
    const status = await recordBillPayment(uid, bill.id, dueDate, input);
    toast.success(status === 'already-recorded' ? 'Payment already recorded' : link ? 'Existing expense linked' : 'Payment added to Expenses');
  }

  return (
    <RecordDialog title="Record payment" description={bill.name + ' · Due ' + formatDate(dueDate)} submitLabel={link ? 'Link expense' : 'Save payment'} onClose={onClose} onSave={save}>
      {link ? (
        <label className="m3-field"><span id="linked-expense-label">Expense already logged</span>
          <select name="expense" aria-labelledby="linked-expense-label" required>
            <option value="">Choose an expense</option>
            {candidates.map((expense) => <option key={expense.id} value={expense.id}>{expense.description || expense.category} · {formatCurrency(expense.amount)} · {formatDate(expense.date)}</option>)}
          </select>
        </label>
      ) : (
        <>
          <AmountField label="Amount paid" paise={bill.amountPaise} />
          <details className="money-details"><summary>Paid today · Change date</summary>
            <label className="m3-field"><span>Paid on</span><input name="date" type="date" max={today} defaultValue={today} /></label>
          </details>
        </>
      )}
      {candidates.length > 0 && <Button type="button" variant="ghost" onClick={() => setLink(!link)}>{link ? 'Record a new expense' : 'Already logged it?'}</Button>}
    </RecordDialog>
  );
}
