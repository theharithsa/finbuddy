import { useId, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Check, ChevronDown, Paperclip, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { deleteFile, deleteOwnedReceipt, generateReceiptPath, uploadFile, validateReceiptFile, type ExpenseUpdate } from '@/lib/firebase';
import { localDate } from '@/lib/finance-period';
import { formatDate, getAllApps, getAllCategories, getAllPeople, type CustomCategory, type Expense, type Person } from '@/lib/types';

export type NewExpense = Omit<Expense, 'id' | 'createdAt'>;

interface ExpenseEditorProps {
  expense?: Expense;
  initialAmount?: string;
  initialCategory?: string;
  initialDescription?: string;
  recentCategories?: string[];
  customCategories?: CustomCategory[];
  people?: Person[];
  onClose: () => void;
  onSave: (values: NewExpense & Pick<ExpenseUpdate, '_removeReceipt'>) => Promise<void>;
}

export function ExpenseEditor({
  expense, initialAmount, initialCategory, initialDescription, recentCategories = [],
  customCategories = [], people = [], onClose, onSave,
}: ExpenseEditorProps) {
  const { user } = useAuth();
  const id = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const trigger = useRef(document.activeElement);
  const submitting = useRef(false);
  const today = localDate();
  const [amount, setAmount] = useState(expense?.amount.toString() ?? initialAmount ?? '');
  const [category, setCategory] = useState(expense?.category ?? initialCategory ?? '');
  const [description, setDescription] = useState(expense?.description === 'No description' ? '' : (expense?.description ?? initialDescription ?? ''));
  const [date, setDate] = useState(expense?.date.slice(0, 10) || today);
  const [dateChanged, setDateChanged] = useState(false);
  const [platform, setPlatform] = useState(expense?.app ?? '');
  const [personIds, setPersonIds] = useState(expense?.peopleIds ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const availablePeople = getAllPeople(people);
  const categories = getAllCategories(customCategories);
  const categoryNames = new Set(categories.map(({ name }) => name));
  const shortcuts = [...new Set([...recentCategories.filter((name) => categoryNames.has(name)), ...categories.map(({ name }) => name)])].slice(0, 4);
  const platforms = getAllApps().map(({ name }) => name);
  const existingReceipt = expense?.receiptUrl && !removeReceipt;
  const day = date === today ? 'Today' : formatDate(date);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const rawAmount = amount.trim();
    const unchangedAmount = expense?.amount.toString() === rawAmount;
    const value = Number(rawAmount.replace(',', '.'));
    if ((!unchangedAmount && !/^(?:\d+(?:[.,]\d{0,2})?|[.,]\d{1,2})$/.test(rawAmount)) || value <= 0 || !Number.isSafeInteger(Math.round(value * 100))) {
      setError('Enter a positive amount with up to two decimal places.');
      amountRef.current?.focus();
      return;
    }
    if (!category) {
      setError('Choose a category.');
      categoryRef.current?.focus();
      return;
    }
    if (!date) {
      setExpanded(true);
      setError('Choose a date.');
      return;
    }
    if (!user) {
      setError('Sign in to save an expense.');
      return;
    }

    submitting.current = true;
    setSaving(true);
    setError('');
    let uploadedPath: string | undefined;
    try {
      let receiptUrl = existingReceipt ? expense?.receiptUrl : undefined;
      let receiptFileName = existingReceipt ? expense?.receiptFileName : undefined;
      if (file) {
        const path = generateReceiptPath(user.uid, file.name);
        uploadedPath = path;
        receiptUrl = await uploadFile(file, path);
        receiptFileName = file.name;
      }
      await onSave({
        amount: value,
        category,
        description: description.trim() || 'No description',
        date: expense && !dateChanged ? expense.date : date,
        app: platform || (expense && !expense.app ? undefined : 'Cash'),
        peopleIds: personIds,
        receiptUrl,
        receiptFileName,
        ...(expense?.receiptUrl && !receiptUrl && { _removeReceipt: true }),
      });
      uploadedPath = undefined;
      if (expense?.receiptUrl && expense.receiptUrl !== receiptUrl) {
        void deleteOwnedReceipt(user.uid, expense.receiptUrl);
      }
      onClose();
    } catch {
      if (uploadedPath) await deleteFile(uploadedPath);
      setError('Couldn’t save the expense. Your entries are still here. Try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  function changeReceipt(next: File | undefined) {
    if (!next) return;
    try {
      validateReceiptFile(next);
      setFile(next);
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Choose an image or PDF up to 5 MB.');
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !submitting.current) onClose(); }}>
      <DialogContent
        className="m3-expense-dialog"
        closeDisabled={saving}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          amountRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (trigger.current instanceof HTMLElement && trigger.current.isConnected) trigger.current.focus();
        }}
      >
        <DialogHeader>
          <span className="m3-dialog-icon"><ReceiptText size={22} /></span>
          <DialogTitle>{expense ? 'Edit expense' : 'Add expense'}</DialogTitle>
          <DialogDescription>{expense ? 'Update the details for this entry.' : 'Enter the amount and choose a category.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="m3-expense-form" noValidate>
          <label className="m3-field m3-amount-field">
            <span>Amount</span>
            <div><span aria-hidden="true">₹</span><input ref={amountRef} inputMode="decimal" autoComplete="off" maxLength={16} placeholder="0.00" required disabled={saving} value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
          </label>
          <div className="m3-expense-category">
            <label className="m3-field">
              <span id={id + "-category-label"}>Category</span>
              <select aria-labelledby={id + "-category-label"} ref={categoryRef} value={category} onChange={(event) => setCategory(event.target.value)} required disabled={saving}>
                <option value="">Choose a category</option>
                {category && !categoryNames.has(category) && <option value={category}>{category}</option>}
                {categories.map(({ name }) => <option key={name}>{name}</option>)}
              </select>
            </label>
            {!expense && <div className="m3-chip-set" role="group" aria-label="Quick categories">
              {shortcuts.map((name) => (
                <button type="button" className="m3-chip" aria-pressed={category === name} key={name} disabled={saving} onClick={() => { setCategory(name); setError(''); }}>
                  {category === name && <Check size={15} />}{name}
                </button>
              ))}
            </div>}
          </div>
          <label className="m3-field">
            <span>Note <small>Optional</small></span>
            <input autoComplete="off" placeholder="What was it for?" value={description} disabled={saving} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <button type="button" className="m3-expense-disclosure" aria-expanded={expanded} aria-controls={`${id}-details`} onClick={() => setExpanded(!expanded)} disabled={saving}>
            <CalendarDays size={18} /> <span>{day} · More details{existingReceipt && !expanded ? ' · Receipt attached' : ''}</span><ChevronDown size={18} />
          </button>
          <div className="m3-expense-details" id={`${id}-details`} hidden={!expanded}>
            <label className="m3-field">
              <span>Date</span><input type="date" value={date} disabled={saving} onChange={(event) => { setDate(event.target.value); setDateChanged(true); }} />
            </label>
            <label className="m3-field">
              <span id={id + "-platform-label"}>Platform</span>
              <select aria-labelledby={id + "-platform-label"} value={platform} disabled={saving} onChange={(event) => setPlatform(event.target.value)}>
                <option value="">Cash (default)</option>
                {platform && !platforms.includes(platform) && <option>{platform}</option>}
                {platforms.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            {availablePeople.length > 0 && <fieldset className="m3-people-field">
              <legend>People</legend>
              <div className="m3-chip-set">
                {availablePeople.map(({ id: personId, name }) => {
                  const selected = personIds.includes(personId);
                  return <button type="button" key={personId} className="m3-chip" aria-pressed={selected} disabled={saving} onClick={() => setPersonIds((ids) => selected ? ids.filter((item) => item !== personId) : [...ids, personId])}>{selected && <Check size={15} />}{name}</button>;
                })}
              </div>
            </fieldset>}
            <div className="m3-receipt-field">
              <label className="m3-field">
                <span><Paperclip size={16} /> {existingReceipt ? 'Replace receipt' : 'Attach receipt'}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={saving} onChange={(event) => { changeReceipt(event.target.files?.[0]); event.target.value = ''; }} />
              </label>
              {(file || existingReceipt) && <div className="m3-receipt-file">
                <span>{file?.name || expense?.receiptFileName || 'Attached receipt'}</span>
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => { if (file) setFile(null); else setRemoveReceipt(true); }}>{file ? 'Clear file' : 'Remove receipt'}</Button>
              </div>}
              {removeReceipt && !file && <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setRemoveReceipt(false)}>Keep existing receipt</Button>}
            </div>
          </div>
          {error && <p className="m3-field-error" role="alert">{error}</p>}
          <div className="m3-expense-actions">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : expense ? 'Save changes' : 'Save expense'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
