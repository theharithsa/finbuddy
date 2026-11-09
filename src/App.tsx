import { lazy, Suspense, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { CalendarDays, ChartNoAxesCombined, ChevronRight, CircleHelp, House, Landmark, LayoutDashboard, LogOut, Menu, Plus, ReceiptText, Repeat2, Settings, Shapes, Sparkles, Trash2, Users, Wallet } from '@/components/brand/Icons';
import { toast } from 'sonner';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useFirestoreData } from '@/hooks/useFirestoreData';
import { deleteOwnedReceipt, logOut } from '@/lib/firebase';
import { getAllCategories, getAllPeople, type Expense } from '@/lib/types';
import { APP_VERSION_DISPLAY } from '@/lib/version';
import { UsageAnalytics } from '@/features/account/UsageAnalytics';
import { LoginPage, Wordmark } from '@/features/account/LoginPage';
import { Ledger } from '@/features/workspace/Ledger';
import { Overview } from '@/features/workspace/Overview';
import { localDate, monthRange, periodExpenses, shiftMonth, totalAmount } from '@/lib/finance-period';
import { useHouseholdData } from '@/hooks/useHouseholdData';
import { listBillOccurrences, type BillOccurrence } from '@/lib/household';
import { MoneyHome } from '@/features/household/MoneyHome';
import { BillsPage } from '@/features/household/BillsPage';
import { SavingsPage } from '@/features/household/SavingsPage';
import { HouseholdEditor, type Editor } from '@/features/household/HouseholdEditor';
import { BillPaymentEditor } from '@/features/household/BillPaymentEditor';
import { KautilyaComingSoon } from '@/features/household/KautilyaComingSoon';
import { SettingsPage } from '@/features/settings/SettingsPage';

const BudgetManager = lazy(() => import('@/components/BudgetManager').then(({ BudgetManager }) => ({ default: BudgetManager })));
const RecurringTemplates = lazy(() => import('@/components/RecurringTemplates').then(({ RecurringTemplates }) => ({ default: RecurringTemplates })));
const CategoryManager = lazy(() => import('@/components/CategoryManager').then(({ CategoryManager }) => ({ default: CategoryManager })));
const PeopleManager = lazy(() => import('@/components/PeopleManager').then(({ PeopleManager }) => ({ default: PeopleManager })));
const MetricsExplorer = lazy(() => import('@/components/MetricsExplorer').then(({ MetricsExplorer }) => ({ default: MetricsExplorer })));

const mainPages = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'savings', label: 'Savings', icon: Landmark },
] as const;

const morePages = [
  { id: 'bills', label: 'Bills & EMIs', description: 'See payments still due', icon: CalendarDays },
  { id: 'settings', label: 'Settings', description: 'Change font, colors, and display mode', icon: Settings },
  { id: 'budgets', label: 'Budgets', description: 'Set category spending limits', icon: Wallet },
  { id: 'dashboard', label: 'Overview', description: 'Review your spending by month', icon: LayoutDashboard },
  { id: 'templates', label: 'Recurring', description: 'Reuse expenses you log regularly', icon: Repeat2 },
  { id: 'categories', label: 'Categories', description: 'Organize where your money goes', icon: Shapes },
  { id: 'people', label: 'People', description: 'Track spending for other people', icon: Users },
  { id: 'explorer', label: 'Metrics Explorer', description: 'Explore and compare spending patterns', icon: ChartNoAxesCombined },
  { id: 'ai-chat', label: 'KautilyaAI', description: 'Coming soon', icon: Sparkles },
] as const;

type Page = (typeof mainPages)[number]['id'] | (typeof morePages)[number]['id'];

function Workspace({ user }: { user: User }) {
  const data = useFirestoreData();
  const household = useHouseholdData(user.uid);
  const shortcut = new URLSearchParams(location.search).get('action');
  const [page, setPage] = useState<Page>(shortcut === 'view-budget' ? 'budgets' : shortcut === 'add-expense' ? 'expenses' : 'home');
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(shortcut === 'add-expense');
  const [entryEditor, setEntryEditor] = useState<Editor | null>(null);
  const [paymentEditor, setPaymentEditor] = useState<BillOccurrence | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deletingPending, setDeletingPending] = useState(false);
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [homeMonth, setHomeMonth] = useState<string | null>(null);
  const [range, setRange] = useState(() => monthRange(month));
  const [signingOut, setSigningOut] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const people = getAllPeople([...data.customPeople, ...data.publicPeople]);
  const categories = getAllCategories(data.customCategories);
  const name = user.displayName || user.email || 'Your account';
  const currentPage = [...mainPages, ...morePages].find(({ id }) => id === page)?.label;
  const moreSelected = morePages.some(({ id }) => id === page);

  const today = localDate();
  const currentMonth = today.slice(0, 7);
  const selectedMonth = page === 'home' ? homeMonth ?? currentMonth : currentMonth;
  const selectedRange = monthRange(selectedMonth);
  const throughDate = selectedMonth === currentMonth ? today : selectedRange.to;
  const selectedIncome = household.data.income.filter(({ date }) => date >= selectedRange.from && date <= throughDate).sort((a, b) => b.date.localeCompare(a.date));
  const spentPaise = Math.round(totalAmount(periodExpenses(data.expenses, selectedRange.from, throughDate)) * 100);
  const bills = listBillOccurrences(household.data.bills, household.data.payments, data.expenses, selectedMonth, throughDate);
  const householdPage = page === 'home' || page === 'bills' || page === 'savings';
  const expenseDependentPage = page !== 'savings' && page !== 'ai-chat' && page !== 'settings';

  function navigate(next: Page) {
    setPage(next);
    setMenu(false);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  }

  async function addExpense(values: Omit<Expense, 'id' | 'createdAt'>) {
    await data.addExpense(values);
    toast.success('Expense added');
  }

  async function confirmDelete() {
    if (!deleting || deletingPending) return;
    setDeletingPending(true);
    try {
      await data.deleteExpense(deleting.id);
      if (deleting.receiptUrl) void deleteOwnedReceipt(user.uid, deleting.receiptUrl);
      setDeleting(null);
      toast.success('Expense deleted');
    } catch {
      toast.error('Could not delete the expense. Try again.');
    } finally {
      setDeletingPending(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await logOut();
    } catch {
      toast.error('Could not sign out. Try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="m3-shell">
      <a className="m3-skip" href="#workspace">Skip to workspace</a>
      <aside className="m3-navigation">
        <button className="m3-fab" title="Add expense" onClick={() => setAdding(true)} disabled={data.loading || data.error}>
          <Plus size={24} /> <span>Add expense</span>
        </button>
        <nav aria-label="Workspace">
          {mainPages.map(({ id, label, icon: Icon }) => (
            <button type="button" className="m3-destination" key={id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>
              <span className="m3-destination-indicator"><Icon size={22} /></span><span>{label}</span>
            </button>
          ))}
          <Dialog open={menu} onOpenChange={setMenu}>
            <DialogTrigger asChild>
              <button type="button" className="m3-destination" data-selected={moreSelected || undefined}><span className="m3-destination-indicator"><Menu size={22} /></span><span>More</span></button>
            </DialogTrigger>
            <DialogContent className="m3-drawer">
              <DialogHeader><DialogTitle>More</DialogTitle><DialogDescription>Manage your workspace and explore spending.</DialogDescription></DialogHeader>
              <div className="m3-drawer-account">
                <span className="m3-row-icon" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>
                <div><strong title={name}>{name}</strong><small>Personal workspace</small></div>
              </div>
              <nav className="m3-drawer-list" aria-label="More destinations">
                {morePages.map(({ id, label, description, icon: Icon }) => (
                  <button type="button" key={id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>
                    <Icon size={21} /><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={18} />
                  </button>
                ))}
                <a href="/docs/"><CircleHelp size={21} /><span><strong>Help center</strong></span><ChevronRight size={18} /></a>
              </nav>
              <div className="m3-drawer-footer">
                <UsageAnalytics />
                <Button variant="outline" onClick={signOut} disabled={signingOut}><LogOut size={18} />{signingOut ? 'Signing out…' : 'Sign out'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </nav>
      </aside>

      <div className="m3-main">
        <header className="m3-app-bar">
          <Wordmark />
          <ThemeToggle />
        </header>
        <main id="workspace" className="m3-workspace" tabIndex={-1} ref={mainRef}>
          {expenseDependentPage && data.error ? <section className="m3-empty" role="alert"><h1>Couldn’t load your workspace</h1><p>Check your connection and try again.</p><Button onClick={() => location.reload()}>Reload workspace</Button></section> :
            expenseDependentPage && data.loading ? <div className="m3-loading" role="status">Loading your workspace…</div> :
            householdPage && household.error ? <section className="m3-empty" role="alert"><h1>Couldn’t load household money</h1><p>Check your connection and try again.</p><Button onClick={household.retry}>Try again</Button></section> :
            householdPage && household.loading ? <div className="m3-loading" role="status">Loading household money…</div> : (
              <Suspense fallback={<div className="m3-loading" role="status">Loading {currentPage}…</div>}>
                {page === 'home' && <MoneyHome
                  monthLabel={new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(selectedRange.from + 'T12:00:00'))}
                  currentMonth={selectedMonth === currentMonth} today={throughDate}
                  income={selectedIncome} spentPaise={spentPaise} bills={bills} holdings={household.data.holdings}
                  onMonthChange={(direction) => {
                    const next = shiftMonth(selectedMonth, direction);
                    setHomeMonth(next >= currentMonth ? null : next);
                  }}
                  onEdit={setEntryEditor} onExpenses={() => { setMonth(selectedMonth); setRange(selectedRange); navigate('expenses'); }}
                  onBills={() => navigate('bills')} onSavings={() => navigate('savings')}
                />}
                {page === 'bills' && <BillsPage bills={household.data.bills} occurrences={bills} today={today} onEdit={setEntryEditor} onPay={setPaymentEditor} />}
                {page === 'savings' && <SavingsPage holdings={household.data.holdings} onEdit={setEntryEditor} />}
                {page === 'settings' && <SettingsPage />}
                {page === 'dashboard' && <Overview expenses={data.expenses} budgets={data.budgets} categories={categories} month={month} onMonthChange={setMonth} onOpenLedger={() => { setRange(monthRange(month)); navigate('expenses'); }} onOpenBudgets={() => navigate('budgets')} onAddExpense={() => setAdding(true)} />}
                {page === 'expenses' && <Ledger expenses={data.expenses} categories={categories} people={people} range={range} onRangeChange={setRange} onEdit={setEditing} onDelete={setDeleting} onAdd={() => setAdding(true)} />}
                {page === 'budgets' && <BudgetManager budgets={data.budgets} expenses={data.expenses} onAddBudget={data.addBudget} onDeleteBudget={data.deleteBudget} onUpdateBudget={data.updateBudget} customCategories={data.customCategories} budgetTemplates={data.budgetTemplates} publicBudgetTemplates={data.publicBudgetTemplates} onAdoptBudgetTemplate={data.adoptBudgetTemplate} onAddBudgetTemplate={data.addBudgetTemplate} onUpdateBudgetTemplate={data.updateBudgetTemplate} onDeleteBudgetTemplate={data.deleteBudgetTemplate} />}
                {page === 'templates' && <RecurringTemplates onAddExpense={addExpense} onAddTemplate={data.addTemplate} onDeleteTemplate={data.deleteTemplate} customCategories={data.customCategories} customPeople={data.customPeople} publicPeople={data.publicPeople} />}
                {page === 'categories' && <CategoryManager customCategories={data.customCategories} publicCategories={data.publicCategories} onAddCategory={data.addCustomCategory} onUpdateCategory={data.updateCustomCategory} onDeleteCategory={data.deleteCustomCategory} onAdoptCategory={data.adoptCategory} />}
                {page === 'people' && <PeopleManager user={user} customPeople={data.customPeople} publicPeople={data.publicPeople} onAddPerson={data.addPerson} onUpdatePerson={data.updatePerson} onDeletePerson={data.deletePerson} onAdoptPerson={data.adoptPerson} />}
                {page === 'explorer' && <MetricsExplorer expenses={data.expenses} budgets={data.budgets} customCategories={data.customCategories} customPeople={data.customPeople} publicPeople={data.publicPeople} />}
                {page === 'ai-chat' && <KautilyaComingSoon onHome={() => navigate('home')} />}
              </Suspense>
            )}
          <footer className="m3-footer"><span>FinBuddy {APP_VERSION_DISPLAY}</span><a href="/docs/privacy-policy.html">Privacy</a><a href="/docs/terms-and-conditions.html">Terms</a></footer>
        </main>
      </div>

      {entryEditor && <HouseholdEditor uid={user.uid} editor={entryEditor} onClose={() => setEntryEditor(null)} />}
      {paymentEditor && <BillPaymentEditor uid={user.uid} occurrence={paymentEditor} expenses={data.expenses} onClose={() => setPaymentEditor(null)} />}
      {adding && !data.loading && !data.error && <AddExpenseModal isOpen onClose={() => setAdding(false)} onAddExpense={addExpense} customCategories={data.customCategories} customPeople={data.customPeople} publicPeople={data.publicPeople} recentCategories={data.expenses.map(({ category }) => category)} />}
      {editing && <EditExpenseModal expense={editing} isOpen onClose={() => setEditing(null)} onUpdate={data.updateExpense} customCategories={data.customCategories} customPeople={data.customPeople} publicPeople={data.publicPeople} />}
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !deletingPending) setDeleting(null); }}>
        <AlertDialogContent onCloseAutoFocus={(event) => { event.preventDefault(); mainRef.current?.focus({ preventScroll: true }); }}>
          <AlertDialogHeader><span className="m3-dialog-icon m3-danger-icon"><Trash2 size={22} /></span><AlertDialogTitle>Delete expense?</AlertDialogTitle><AlertDialogDescription>This permanently removes the expense from your ledger.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={deletingPending}>Cancel</AlertDialogCancel><Button variant="destructive" disabled={deletingPending} onClick={confirmDelete}>{deletingPending ? 'Deleting…' : 'Delete expense'}</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AppContent() {
  const { user, loading, redirectError } = useAuth();
  if (loading) return <div className="m3-loading m3-fullscreen" role="status">Opening FinBuddy…</div>;
  return user ? <Workspace key={user.uid} user={user} /> : <LoginPage redirectError={redirectError} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster
        position="bottom-center"
        offset={{ bottom: 'var(--finbuddy-toast-bottom, 24px)' }}
        mobileOffset={{ bottom: 'var(--finbuddy-toast-bottom, 16px)' }}
      />
    </AuthProvider>
  );
}
