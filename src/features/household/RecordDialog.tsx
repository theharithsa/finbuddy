import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export class EntryError extends Error {}

interface RecordDialogProps {
  title: string;
  description: string;
  submitLabel: string;
  children: ReactNode;
  onClose: () => void;
  onSave: (values: FormData) => Promise<void>;
  onRemove?: () => Promise<void>;
  removeDescription?: string;
}

export function RecordDialog({ title, description, submitLabel, children, onClose, onSave, onRemove, removeDescription }: RecordDialogProps) {
  const trigger = useRef(document.activeElement);
  const pending = useRef(false);
  const removeButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const restoreRemoveFocus = useRef(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    if (confirm) {
      keepButton.current?.focus();
    } else if (restoreRemoveFocus.current) {
      restoreRemoveFocus.current = false;
      removeButton.current?.focus();
    }
  }, [confirm]);

  function keepEntry() {
    restoreRemoveFocus.current = true;
    setConfirm(false);
    setError('');
  }

  async function run(operation: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await operation();
      onClose();
    } catch (failure) {
      setError(failure instanceof EntryError ? failure.message : 'Couldn’t save this change. Try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm) return;
    const values = new FormData(event.currentTarget);
    void run(() => onSave(values));
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending.current) onClose(); }}>
      <DialogContent
        className="m3-expense-dialog"
        closeDisabled={busy}
        onCloseAutoFocus={(event) => {
          if (trigger.current instanceof HTMLElement && trigger.current.isConnected) {
            event.preventDefault();
            trigger.current.focus();
          }
        }}
      >
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <form className="money-form" hidden={confirm} onSubmit={submit} noValidate>
          <fieldset disabled={busy || confirm}>{children}</fieldset>
          {!confirm && error && <p className="m3-field-error" role="alert">{error}</p>}
          <div className="m3-expense-actions">
            {onRemove && <Button ref={removeButton} type="button" className="money-remove" variant="ghost" onClick={() => { setConfirm(true); setError(''); }} disabled={busy}>Remove</Button>}
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
          </div>
        </form>
        {confirm && onRemove && (
          <div className="money-form">
            <p>{removeDescription ?? 'This removes the entry from your totals.'}</p>
            {error && <p className="m3-field-error" role="alert">{error}</p>}
            <div className="m3-expense-actions">
              <Button ref={keepButton} variant="ghost" disabled={busy} onClick={keepEntry}>Keep entry</Button>
              <Button variant="destructive" disabled={busy} onClick={() => run(onRemove)}>{busy ? 'Removing…' : 'Remove entry'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function AmountField({ label, paise }: { label: string; paise?: number }) {
  return <label className="m3-field money-amount-field">
    <span>{label}</span>
    <div><span aria-hidden="true">₹</span><input name="amount" inputMode="decimal" autoComplete="off" maxLength={16} placeholder="0.00" defaultValue={paise === undefined ? undefined : String(paise / 100)} required /></div>
  </label>;
}

export function textValue(values: FormData, key: string): string {
  const value = values.get(key);
  return typeof value === 'string' ? value.trim() : '';
}
