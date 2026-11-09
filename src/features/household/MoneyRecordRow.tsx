import { useId } from 'react';
import { ChevronRight } from '@/components/brand/Icons';

export function MoneyRecordRow({ title, description, amount, onEdit, editLabel }: {
  title: string;
  description: string;
  amount: string;
  onEdit?: () => void;
  editLabel?: string;
}) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const amountId = `${id}-amount`;
  const content = <><span><strong>{title}</strong><small id={descriptionId}>{description}</small></span><strong id={amountId}>{amount}</strong></>;
  return onEdit
    ? <button type="button" aria-label={editLabel} aria-describedby={editLabel ? `${amountId} ${descriptionId}` : undefined} onClick={onEdit}>{content}<ChevronRight size={18} /></button>
    : <div className="money-record-row">{content}</div>;
}
