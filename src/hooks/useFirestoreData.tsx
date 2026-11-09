import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { observeOperation } from '@/lib/operation-monitoring';
import {
  type ExpenseUpdate,
  subscribeToExpenses,
  subscribeToBudgets,
  subscribeToTemplates,
  subscribeToCustomCategories,
  subscribeToPublicCategories,
  subscribeToCustomPeople,
  subscribeToPublicPeople,
  subscribeToBudgetTemplates,
  subscribeToPublicBudgetTemplates,
  addExpenseToFirestore,
  updateExpenseInFirestore,
  deleteExpenseFromFirestore,
  addBudgetToFirestore,
  updateBudgetInFirestore,
  deleteBudgetFromFirestore,
  addTemplateToFirestore,
  deleteTemplateFromFirestore,
  addCustomCategoryToFirestore,
  updateCustomCategoryInFirestore,
  deleteCustomCategoryFromFirestore,
  addPersonToFirestore,
  updatePersonInFirestore,
  deletePersonFromFirestore,
  adoptPublicCategory,
  adoptPublicPerson,
  addBudgetTemplateToFirestore,
  updateBudgetTemplateInFirestore,
  deleteBudgetTemplateFromFirestore,
  adoptPublicBudgetTemplate,
} from '@/lib/firebase';
import { type Expense, type Budget, type RecurringTemplate, type CustomCategory, type BudgetTemplate, type Person } from '@/lib/types';

export function useFirestoreData() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [publicCategories, setPublicCategories] = useState<CustomCategory[]>([]);
  const [customPeople, setCustomPeople] = useState<Person[]>([]);
  const [publicPeople, setPublicPeople] = useState<Person[]>([]);
  const [budgetTemplates, setBudgetTemplates] = useState<BudgetTemplate[]>([]);
  const [publicBudgetTemplates, setPublicBudgetTemplates] = useState<BudgetTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const userId = user?.uid;

  useEffect(() => {
    setLoading(Boolean(userId));
    setError(false);
    setExpenses([]);
    setBudgets([]);
    setTemplates([]);
    setCustomCategories([]);
    setPublicCategories([]);
    setCustomPeople([]);
    setPublicPeople([]);
    setBudgetTemplates([]);
    setPublicBudgetTemplates([]);
    if (!userId) return;

    const unsubscribers: (() => void)[] = [];
    const pending = new Set(['expenses', 'budgets', 'categories', 'people', 'budgetTemplates']);
    function ready(name: string) {
      pending.delete(name);
      if (!pending.size) setLoading(false);
    }
    const fail = () => { setError(true); setLoading(false); };

    try {
      unsubscribers.push(subscribeToExpenses(userId, (value) => { setExpenses(value); ready('expenses'); }, fail));
      unsubscribers.push(subscribeToBudgets(userId, (value) => { setBudgets(value); ready('budgets'); }, fail));
      unsubscribers.push(subscribeToTemplates(userId, setTemplates));
      unsubscribers.push(subscribeToCustomCategories(userId, (value) => { setCustomCategories(value); ready('categories'); }));
      unsubscribers.push(subscribeToCustomPeople(userId, (value) => { setCustomPeople(value); ready('people'); }));
      unsubscribers.push(subscribeToBudgetTemplates(userId, (value) => { setBudgetTemplates(value); ready('budgetTemplates'); }));
      unsubscribers.push(subscribeToPublicCategories(setPublicCategories));
      unsubscribers.push(subscribeToPublicPeople(setPublicPeople));
      unsubscribers.push(subscribeToPublicBudgetTemplates(setPublicBudgetTemplates));
    } catch {
      fail();
    }
    return () => { unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  }, [userId]);

  const addExpense = async (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    if (!userId) throw new Error('User not authenticated');
    return observeOperation('expense.create', () => addExpenseToFirestore(userId, expense));
  };

  const updateExpense = async (expenseId: string, expense: ExpenseUpdate) => {
    if (!userId) throw new Error('User not authenticated');
    await observeOperation('expense.update', () => updateExpenseInFirestore(userId, expenseId, expense));
  };

  const deleteExpense = async (expenseId: string) => {
    if (!userId) throw new Error('User not authenticated');
    await observeOperation('expense.delete', () => deleteExpenseFromFirestore(userId, expenseId));
  };

  // Budget operations
  const addBudget = async (budgetData: Omit<Budget, 'id'>) => {
    if (!user) throw new Error('User not authenticated');
    await observeOperation('budget.create', () => addBudgetToFirestore(user.uid, budgetData));
  };

  const updateBudget = async (budgetId: string, budgetData: Partial<Budget>) => {
    if (!user) throw new Error('User not authenticated');
    await observeOperation('budget.update', () => updateBudgetInFirestore(user.uid, budgetId, budgetData));
  };

  const deleteBudget = async (budgetId: string) => {
    if (!user) throw new Error('User not authenticated');
    await observeOperation('budget.delete', () => deleteBudgetFromFirestore(user.uid, budgetId));
  };

  // Template operations
  const addTemplate = async (templateData: Omit<RecurringTemplate, 'id' | 'createdAt'>) => {
    if (!user) throw new Error('User not authenticated');
    
    const template = {
      ...templateData,
      createdAt: new Date().toISOString(),
    };
    
    await addTemplateToFirestore(user.uid, template);
  };

  const deleteTemplate = async (templateId: string) => {
    if (!user) throw new Error('User not authenticated');
    await deleteTemplateFromFirestore(user.uid, templateId);
  };

  // Custom Category operations
  const addCustomCategory = async (categoryData: Omit<CustomCategory, 'id' | 'createdAt' | 'userId'>) => {
    if (!user) throw new Error('User not authenticated');
    
    const category = {
      ...categoryData,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      createdBy: user.displayName || user.email || 'Anonymous'
    };
    
    await addCustomCategoryToFirestore(user.uid, category);
  };

  const updateCustomCategory = async (categoryId: string, categoryData: Partial<CustomCategory>) => {
    if (!user) throw new Error('User not authenticated');
    await updateCustomCategoryInFirestore(user.uid, categoryId, categoryData);
  };

  const deleteCustomCategory = async (categoryId: string) => {
    if (!user) throw new Error('User not authenticated');
    await deleteCustomCategoryFromFirestore(user.uid, categoryId);
  };

  const adoptCategory = async (publicCategory: CustomCategory) => {
    if (!user) throw new Error('User not authenticated');
    await adoptPublicCategory(user.uid, publicCategory);
  };

  // Person operations
  const addPerson = async (personData: Omit<Person, 'id' | 'createdAt' | 'userId'>) => {
    if (!user) throw new Error('User not authenticated');
    
    const person = {
      ...personData,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      createdBy: user.displayName || user.email || 'Anonymous'
    };
    
    await addPersonToFirestore(user.uid, person);
  };

  const updatePerson = async (personId: string, personData: Partial<Person>) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    await updatePersonInFirestore(user.uid, personId, personData);
  };

  const deletePerson = async (personId: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    await deletePersonFromFirestore(user.uid, personId);
    
  };

  const adoptPerson = async (publicPerson: Person) => {
    if (!user) throw new Error('User not authenticated');
    await adoptPublicPerson(user.uid, publicPerson);
  };

  // Budget Template operations
  const addBudgetTemplate = async (templateData: Omit<BudgetTemplate, 'id' | 'createdAt' | 'userId' | 'createdBy'>) => {
    if (!user) throw new Error('User not authenticated');
    
    const template = {
      ...templateData,
      userId: user.uid,
      createdAt: new Date().toISOString(),
      createdBy: user.displayName || user.email || 'Anonymous'
    };
    
    await addBudgetTemplateToFirestore(user.uid, template);
  };

  const updateBudgetTemplate = async (templateId: string, templateData: Partial<BudgetTemplate>) => {
    if (!user) throw new Error('User not authenticated');
    await updateBudgetTemplateInFirestore(user.uid, templateId, templateData);
  };

  const deleteBudgetTemplate = async (templateId: string) => {
    if (!user) throw new Error('User not authenticated');
    await deleteBudgetTemplateFromFirestore(user.uid, templateId);
  };

  const adoptBudgetTemplate = async (publicTemplate: BudgetTemplate) => {
    if (!user) throw new Error('User not authenticated');
    await adoptPublicBudgetTemplate(user.uid, publicTemplate);
  };

  return {
    expenses,
    budgets,
    templates,
    customCategories,
    publicCategories,
    customPeople,
    publicPeople,
    budgetTemplates,
    publicBudgetTemplates,
    loading,
    error,
    addExpense,
    updateExpense,
    deleteExpense,
    addBudget,
    updateBudget,
    deleteBudget,
    addTemplate,
    deleteTemplate,
    addCustomCategory,
    updateCustomCategory,
    deleteCustomCategory,
    adoptCategory,
    addPerson,
    updatePerson,
    deletePerson,
    adoptPerson,
    addBudgetTemplate,
    updateBudgetTemplate,
    deleteBudgetTemplate,
    adoptBudgetTemplate,
  };
}
