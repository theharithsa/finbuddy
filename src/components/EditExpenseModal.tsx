import { ExpenseEditor } from '@/features/expenses/ExpenseEditor';
import type { ExpenseUpdate } from '@/lib/firebase';
import type { CustomCategory, Expense, Person } from '@/lib/types';
import { toast } from 'sonner';

interface EditExpenseModalProps {
  expense: Expense;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (expenseId: string, values: ExpenseUpdate) => Promise<void>;
  customCategories?: CustomCategory[];
  customPeople?: Person[];
  publicPeople?: Person[];
}

export function EditExpenseModal({
  expense, isOpen, onClose, onUpdate, customCategories, customPeople = [], publicPeople = [],
}: EditExpenseModalProps) {
  if (!isOpen) return null;
  return (
    <ExpenseEditor
      key={expense.id}
      expense={expense}
      customCategories={customCategories}
      people={[...customPeople, ...publicPeople]}
      onClose={onClose}
      onSave={async (values) => {
        await onUpdate(expense.id, values);
        toast.success('Expense updated');
      }}
    />
  );
}
