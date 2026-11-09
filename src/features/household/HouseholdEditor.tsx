import { toast } from 'sonner';
import { localDate } from '@/lib/finance-period';
import { removeHouseholdEntry, saveHouseholdEntry } from '@/lib/household-firestore';
import { billSchema, holdingKinds, holdingSchema, incomeSchema, parsePaise, type Bill, type Holding, type Income } from '@/lib/household';
import { AmountField, EntryError, RecordDialog, textValue } from './RecordDialog';

export type Editor =
  | { kind: 'income'; entry?: Income; defaultDate?: string }
  | { kind: 'bills'; entry?: Bill }
  | { kind: 'holdings'; entry?: Holding };

const prompts = {
  income: { add: 'Add income', edit: 'Edit income', description: 'Record money you’ve received.', amount: 'Amount received' },
  bills: { add: 'Add bill', edit: 'Edit bill', description: 'Track rent, an EMI, or another payment you need to make.', amount: 'Expected amount' },
  holdings: { add: 'Add savings or investment', edit: 'Update value', description: 'Use the latest balance or value you know.', amount: 'Latest value' },
};

export function HouseholdEditor({ uid, editor, onClose }: { uid: string; editor: Editor; onClose: () => void }) {
  const { kind, entry } = editor;
  const today = localDate();
  const prompt = prompts[kind];

  async function save(values: FormData) {
    const amountPaise = parsePaise(values.get('amount'), kind === 'holdings');
    if (amountPaise === undefined) {
      throw new EntryError(kind === 'holdings' ? 'Enter a value of ₹0 or more.' : 'Enter an amount greater than ₹0.');
    }
    const name = textValue(values, 'name');

    if (editor.kind === 'income') {
      const date = textValue(values, 'date') || today;
      const parsed = incomeSchema.safeParse({ name: name || 'Income', amountPaise, date });
      if (!parsed.success || date > today) throw new EntryError('Check the income label and choose a date up to today.');
      await saveHouseholdEntry(uid, 'income', parsed.data, editor.entry?.id);
    } else if (editor.kind === 'bills') {
      const parsed = billSchema.safeParse({ name, amountPaise, dueDate: textValue(values, 'dueDate'), repeat: textValue(values, 'repeat') });
      if (!parsed.success) throw new EntryError('Enter a bill name and a valid due date.');
      await saveHouseholdEntry(uid, 'bills', parsed.data, editor.entry?.id);
    } else {
      const asOf = textValue(values, 'asOf') || (editor.entry?.amountPaise === amountPaise ? editor.entry.asOf : today);
      const parsed = holdingSchema.safeParse({ name, amountPaise, kind: textValue(values, 'holdingKind'), asOf });
      if (!parsed.success || asOf > today) throw new EntryError('Enter a name and choose a value date up to today.');
      await saveHouseholdEntry(uid, 'holdings', parsed.data, editor.entry?.id);
    }
    toast.success(kind === 'income' ? 'Income saved' : kind === 'bills' ? 'Bill saved' : 'Value saved');
  }

  return (
    <RecordDialog
      title={entry ? prompt.edit : prompt.add}
      description={prompt.description}
      submitLabel={entry ? 'Save changes' : kind === 'income' ? 'Save income' : kind === 'bills' ? 'Save bill' : 'Save value'}
      onClose={onClose}
      onSave={save}
      onRemove={entry ? async () => { await removeHouseholdEntry(uid, kind, entry.id); toast.success('Entry removed'); } : undefined}
      removeDescription={kind === 'bills' ? 'Remove this schedule? Any recorded payments stay in Expenses.' : undefined}
    >
      {kind !== 'income' && <label className="m3-field"><span>Name</span><input name="name" maxLength={80} defaultValue={entry?.name} placeholder={kind === 'bills' ? 'e.g. Rent or home loan EMI' : 'e.g. Emergency savings or PPF'} required /></label>}
      <AmountField label={prompt.amount} paise={entry?.amountPaise} />

      {editor.kind === 'income' && <>
        <label className="m3-field"><span>Label <small>Optional</small></span><input name="name" maxLength={80} defaultValue={editor.entry?.name === 'Income' ? '' : editor.entry?.name} placeholder="e.g. Salary or freelance payment" /></label>
        <details className="money-details" open={editor.defaultDate ? true : undefined}>
          <summary>{editor.entry || editor.defaultDate ? 'Received date' : 'Received today · Change date'}</summary>
          <label className="m3-field"><span>Received on</span><input name="date" type="date" max={today} defaultValue={editor.entry?.date ?? editor.defaultDate ?? today} /></label>
        </details>
      </>}

      {editor.kind === 'bills' && <>
        <label className="m3-field"><span>Due date</span><input name="dueDate" type="date" defaultValue={editor.entry?.dueDate ?? today} required /></label>
        <details className="money-details" open={editor.entry?.repeat !== undefined && editor.entry.repeat !== 'once' ? true : undefined}>
          <summary>Repeat</summary>
          <label className="m3-field"><span id="bill-repeat-label">How often?</span>
            <select aria-labelledby="bill-repeat-label" name="repeat" defaultValue={editor.entry?.repeat ?? 'once'}>
              <option value="once">One time</option><option value="monthly">Every month</option><option value="yearly">Every year</option>
            </select>
          </label>
        </details>
      </>}

      {editor.kind === 'holdings' && <details className="money-details">
        <summary>Type and value date <small>Optional</small></summary>
        <label className="m3-field"><span id="holding-kind-label">Type</span>
          <select aria-labelledby="holding-kind-label" name="holdingKind" defaultValue={editor.entry?.kind ?? 'Other'}>
            {holdingKinds.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="m3-field"><span>Value as of</span><input name="asOf" type="date" max={today} /></label>
      </details>}
    </RecordDialog>
  );
}
