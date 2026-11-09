import { lazy, Suspense, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { ChartNoAxesCombined, ChevronRight, CircleHelp, LayoutDashboard, LogOut, Menu, Plus, ReceiptText, Repeat2, Shapes, Sparkles, Trash2, Users, Wallet } from 'lucide-react';
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
import { localDate, monthRange } from '@/lib/finance-period';

const BudgetManager = lazy(() => import('@/components/BudgetManager').then(({ BudgetManager }) => ({ default: BudgetManager })));
const RecurringTemplates = lazy(() => import('@/components/RecurringTemplates').then(({ RecurringTemplates }) => ({ default: RecurringTemplates })));
const CategoryManager = lazy(() => import('@/components/CategoryManager').then(({ CategoryManager }) => ({ default: CategoryManager })));
const PeopleManager = lazy(() => import('@/components/PeopleManager').then(({ PeopleManager }) => ({ default: PeopleManager })));
const MetricsExplorer = lazy(() => import('@/components/MetricsExplorer').then(({ MetricsExplorer }) => ({ default: MetricsExplorer })));
const AIChatPage = lazy(() => import('@/components/AIChatPage').then(({ AIChatPage }) => ({ default: AIChatPage })));

const mainPages = [
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'budgets', label: 'Budgets', icon: Wallet },
] as const;

const morePages = [
  { id: 'templates', label: 'Recurring', description: 'Reuse expenses you log regularly', icon: Repeat2 },
  { id: 'categories', label: 'Categories', description: 'Organize where your money goes', icon: Shapes },
  { id: 'people', label: 'People', description: 'Track spending for other people', icon: Users },
  { id: 'explorer', label: 'Metrics Explorer', description: 'Explore and compare spending patterns', icon: ChartNoAxesCombined },
  { id: 'ai-chat', label: 'KautilyaAI', description: 'Ask questions about your spending', icon: Sparkles },
] as const;

type Page = (typeof mainPages)[number]['id'] | (typeof morePages)[number]['id'];

function Workspace({ user }: { user: User }) {
  const data = useFirestoreData();
  const shortcut = new URLSearchParams(location.search).get('action');
  const [page, setPage] = useState<Page>(shortcut === 'view-budget' ? 'budgets' : 'expenses');
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(shortcut === 'add-expense');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deletingPending, setDeletingPending] = useState(false);
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [range, setRange] = useState(() => monthRange(month));
  const [signingOut, setSigningOut] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const people = getAllPeople([...data.customPeople, ...data.publicPeople]);
  const categories = getAllCategories(data.customCategories);
  const name = user.displayName || user.email || 'Your account';
  const currentPage = [...mainPages, ...morePages].find(({ id }) => id === page)?.label;
  const moreSelected = morePages.some(({ id }) => id === page);

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
          {data.error ? <section className="m3-empty" role="alert"><h1>Couldn’t load your workspace</h1><p>Check your connection and try again.</p><Button onClick={() => location.reload()}>Reload workspace</Button></section> :
            data.loading ? <div className="m3-loading" role="status">Loading your workspace…</div> : (
              <Suspense fallback={<div className="m3-loading" role="status">Loading {currentPage}…</div>}>
                {page === 'dashboard' && <Overview expenses={data.expenses} budgets={data.budgets} categories={categories} month={month} onMonthChange={setMonth} onOpenLedger={() => { setRange(monthRange(month)); navigate('expenses'); }} onOpenBudgets={() => navigate('budgets')} onAddExpense={() => setAdding(true)} />}
                {page === 'expenses' && <Ledger expenses={data.expenses} categories={categories} people={people} range={range} onRangeChange={setRange} onEdit={setEditing} onDelete={setDeleting} onAdd={() => setAdding(true)} />}
                {page === 'budgets' && <BudgetManager budgets={data.budgets} expenses={data.expenses} onAddBudget={data.addBudget} onDeleteBudget={data.deleteBudget} onUpdateBudget={data.updateBudget} customCategories={data.customCategories} budgetTemplates={data.budgetTemplates} publicBudgetTemplates={data.publicBudgetTemplates} onAdoptBudgetTemplate={data.adoptBudgetTemplate} onAddBudgetTemplate={data.addBudgetTemplate} onUpdateBudgetTemplate={data.updateBudgetTemplate} onDeleteBudgetTemplate={data.deleteBudgetTemplate} />}
                {page === 'templates' && <RecurringTemplates onAddExpense={addExpense} onAddTemplate={data.addTemplate} onDeleteTemplate={data.deleteTemplate} customCategories={data.customCategories} customPeople={data.customPeople} publicPeople={data.publicPeople} />}
                {page === 'categories' && <CategoryManager customCategories={data.customCategories} publicCategories={data.publicCategories} onAddCategory={data.addCustomCategory} onUpdateCategory={data.updateCustomCategory} onDeleteCategory={data.deleteCustomCategory} onAdoptCategory={data.adoptCategory} />}
                {page === 'people' && <PeopleManager user={user} customPeople={data.customPeople} publicPeople={data.publicPeople} onAddPerson={data.addPerson} onUpdatePerson={data.updatePerson} onDeletePerson={data.deletePerson} onAdoptPerson={data.adoptPerson} />}
                {page === 'explorer' && <MetricsExplorer expenses={data.expenses} budgets={data.budgets} customCategories={data.customCategories} customPeople={data.customPeople} publicPeople={data.publicPeople} />}
                {page === 'ai-chat' && <AIChatPage />}
              </Suspense>
            )}
          <footer className="m3-footer"><span>FinBuddy {APP_VERSION_DISPLAY}</span><a href="/docs/privacy-policy.html">Privacy</a><a href="/docs/terms-and-conditions.html">Terms</a></footer>
        </main>
      </div>

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
  return <AuthProvider><AppContent /><Toaster position="bottom-center" /></AuthProvider>;
}
