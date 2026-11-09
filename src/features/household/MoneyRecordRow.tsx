import { ChevronRight } from '@/components/brand/Icons';

export function MoneyRecordRow({ title, description, amount, onEdit, editLabel }: {
  title: string;
  description: string;
  amount: string;
  onEdit?: () => void;
  editLabel?: string;
}) {
  const content = <><span><strong>{title}</strong><small>{description}</small></span><strong>{amount}</strong></>;
  return onEdit
    ? <button type="button" aria-label={editLabel} onClick={onEdit}>{content}<ChevronRight size={18} /></button>
    : <div className="money-record-row">{content}</div>;
}
