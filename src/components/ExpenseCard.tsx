import { ItemIcon } from '@/components/brand/ItemIcon';
import { useRef, useState } from 'react';
import { EllipsisVertical, FileText, Pencil, ReceiptText, Trash2 } from '@/components/brand/Icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatCurrency, type Category, type Expense, type Person } from '@/lib/types';

interface ExpenseCardProps {
  expense: Expense;
  categories: Category[];
  people: Pick<Person, 'id' | 'name'>[];
  onEdit?: () => void;
  onDelete?: () => void;
}

function getReceiptUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || (import.meta.env.DEV && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) {
      return url.href;
    }
  } catch {
    return undefined;
  }
}

export function ExpenseCard({ expense, categories, people, onEdit, onDelete }: ExpenseCardProps) {
  const [viewingReceipt, setViewingReceipt] = useState(false);
  const actions = useRef<HTMLButtonElement>(null);
  const nextAction = useRef<(() => void) | null>(null);
  const label = expense.description && expense.description !== 'No description' ? expense.description : expense.category || 'Expense';
  const icon = categories.find(({ name }) => name === expense.category)?.icon;
  const receiptUrl = getReceiptUrl(expense.receiptUrl);
  const personNames = people.filter(({ id }) => expense.peopleIds?.includes(id)).map(({ name }) => name);
  const metadata = [expense.category, expense.app === 'Cash' ? undefined : expense.app, ...personNames].filter(Boolean).join(' · ');
  const pdf = expense.receiptFileName?.toLowerCase().endsWith('.pdf');

  const row = (
    <>
        <span className="m3-row-icon" aria-hidden="true">{icon ? <ItemIcon value={icon} size={21} /> : <ReceiptText size={21} />}</span>
        <span className="m3-row-label">
          <strong>{label}</strong>
          {metadata && <small>{metadata}</small>}
        </span>
        <span className="m3-row-amount">{formatCurrency(expense.amount)}</span>
    </>
  );
  return (
    <li className="m3-expense-row">
      {onEdit
        ? <button type="button" className="m3-expense-row-main" aria-label={`Edit expense: ${label}`} onClick={onEdit}>{row}</button>
        : <div className="m3-expense-row-main">{row}</div>}
      {(onEdit || onDelete || receiptUrl) && <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button ref={actions} variant="ghost" size="icon" aria-label={`Actions for ${label}`}><EllipsisVertical size={20} /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onCloseAutoFocus={(event) => {
          const action = nextAction.current;
          if (!action) return;
          // Finish the menu focus scope before the next dialog acquires focus.
          nextAction.current = null;
          event.preventDefault();
          actions.current?.focus();
          action();
        }}>
          {onEdit && <DropdownMenuItem onSelect={() => { nextAction.current = onEdit; }}><Pencil size={17} /> Edit expense</DropdownMenuItem>}
          {receiptUrl && <DropdownMenuItem onSelect={() => { nextAction.current = () => setViewingReceipt(true); }}><FileText size={17} /> View receipt</DropdownMenuItem>}
          {onDelete && <DropdownMenuItem variant="destructive" onSelect={() => { nextAction.current = onDelete; }}><Trash2 size={17} /> Delete expense</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>}
      {receiptUrl && viewingReceipt && (
        <Dialog open onOpenChange={setViewingReceipt}>
          <DialogContent className="sm:max-w-2xl" onCloseAutoFocus={(event) => {
            event.preventDefault();
            actions.current?.focus();
          }}>
            <DialogHeader>
              <DialogTitle>Receipt</DialogTitle>
              <DialogDescription>{expense.receiptFileName || label}</DialogDescription>
            </DialogHeader>
            {pdf
              ? <iframe src={receiptUrl} title="Receipt PDF" className="m3-receipt-preview" sandbox="" />
              : <img src={receiptUrl} alt="Expense receipt" className="m3-receipt-preview" />}
            <Button variant="outline" asChild><a href={receiptUrl} target="_blank" rel="noreferrer">Open receipt in new tab</a></Button>
          </DialogContent>
        </Dialog>
      )}
    </li>
  );
}
