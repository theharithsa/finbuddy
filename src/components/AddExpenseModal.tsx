import { ExpenseEditor, type NewExpense } from '@/features/expenses/ExpenseEditor';
import type { CustomCategory, Person } from '@/lib/types';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (expense: NewExpense) => Promise<void>;
  customCategories?: CustomCategory[];
  customPeople?: Person[];
  publicPeople?: Person[];
  recentCategories?: string[];
  initialAmount?: string;
  initialCategory?: string;
  initialDescription?: string;
}

export function AddExpenseModal({
  isOpen, onClose, onAddExpense, customPeople = [], publicPeople = [], ...props
}: AddExpenseModalProps) {
  if (!isOpen) return null;
  return (
    <ExpenseEditor
      {...props}
      people={[...customPeople, ...publicPeople]}
      onClose={onClose}
      onSave={onAddExpense}
    />
  );
}
