import { lazy, Suspense, useState } from 'react';
import type { User } from 'firebase/auth';
import { ArrowRight, ChartNoAxesCombined, CircleHelp, LayoutDashboard, LogOut, Menu, Plus, ReceiptText, Repeat2, Shapes, Sparkles, Users, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { AddExpenseModal } from '@/components/AddExpenseModal';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useFirestoreData } from '@/hooks/useFirestoreData';
import { deleteOwnedReceipt, logOut } from '@/lib/firebase';
import { getAllCategories, type Expense } from '@/lib/types';
import { APP_VERSION_DISPLAY } from '@/lib/version';
import { UsageAnalytics } from '@/features/account/UsageAnalytics';
import { LoginPage, Wordmark } from '@/features/account/LoginPage';
import { Ledger } from '@/features/workspace/Ledger';
import { Overview } from '@/features/workspace/Overview';
import { localDate, monthRange, periodExpenses } from '@/lib/finance-period';

const BudgetManager = lazy(() => import('@/components/BudgetManager').then(({ BudgetManager }) => ({ default: BudgetManager })));
const RecurringTemplates = lazy(() => import('@/components/RecurringTemplates').then(({ RecurringTemplates }) => ({ default: RecurringTemplates })));
const CategoryManager = lazy(() => import('@/components/CategoryManager').then(({ CategoryManager }) => ({ default: CategoryManager })));
const PeopleManager = lazy(() => import('@/components/PeopleManager').then(({ PeopleManager }) => ({ default: PeopleManager })));
const MetricsExplorer = lazy(() => import('@/components/MetricsExplorer').then(({ MetricsExplorer }) => ({ default: MetricsExplorer })));
const AIChatPage = lazy(() => import('@/components/AIChatPage').then(({ AIChatPage }) => ({ default: AIChatPage })));

const pages = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'budgets', label: 'Budgets', icon: Wallet },
  { id: 'templates', label: 'Recurring', icon: Repeat2 },
  { id: 'categories', label: 'Categories', icon: Shapes },
  { id: 'people', label: 'People', icon: Users },
  { id: 'explorer', label: 'Metrics Explorer', icon: ChartNoAxesCombined },
  { id: 'ai-chat', label: 'KautilyaAI', icon: Sparkles },
] as const;

type Page = (typeof pages)[number]['id'];

function Workspace({ user }: { user: User }) {
  const data = useFirestoreData();
  const shortcut = new URLSearchParams(location.search).get('action');
  const [page, setPage] = useState<Page>(shortcut === 'view-budget' ? 'budgets' : 'dashboard');
  const [menu, setMenu] = useState(false);
  const [adding, setAdding] = useState(shortcut === 'add-expense');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [range, setRange] = useState(() => monthRange(month));
  const [signingOut, setSigningOut] = useState(false);
  const people = [...data.customPeople, ...data.publicPeople];
  const name = user.displayName || user.email || 'Your account';
  const currentPage = pages.find(({ id }) => id === page)?.label;

  function navigate(next: Page) {
    setPage(next);
    setMenu(false);
    window.scrollTo(0, 0);
  }

  async function addExpense(values: Omit<Expense, 'id' | 'createdAt'>) {
    await data.addExpense(values);
    toast.success('Expense added');
  }

  async function deleteExpense(expense: Expense) {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await data.deleteExpense(expense.id);
      if (expense.receiptUrl) void deleteOwnedReceipt(user.uid, expense.receiptUrl);
      toast.success('Expense deleted');
    } catch {
      toast.error('Could not delete the expense. Try again.');
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
    <div className="fb-shell">
      <a className="fb-skip" href="#workspace">Skip to workspace</a>
      <aside className="fb-sidebar" data-open={menu} id="workspace-nav" onKeyDown={(event) => { if (event.key === 'Escape') setMenu(false); }}>
        <div className="fb-sidebar-brand"><Wordmark /><button className="fb-menu-close fb-icon-button" aria-label="Close navigation" onClick={() => setMenu(false)}><X size={20} /></button></div>
        <p className="fb-nav-label">WORKSPACE</p>
        <nav aria-label="Workspace">
          {pages.map(({ id, label, icon: Icon }, index) => (
            <div key={id}>
              {index === 6 && <p className="fb-nav-label fb-nav-divider">INSIGHTS</p>}
              <button aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={18} />{label}</button>
            </div>
          ))}
        </nav>
        <div className="fb-sidebar-foot">
          <a href="/docs/"><CircleHelp size={17} />Help center <ArrowRight size={14} /></a>
          <div className="fb-account"><span className="fb-avatar" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span><div><strong title={name}>{name}</strong><small>Personal workspace</small></div><button className="fb-icon-button" aria-label="Sign out" title="Sign out" disabled={signingOut} onClick={signOut}><LogOut size={16} /></button></div>
        </div>
      </aside>
      {menu && <button className="fb-scrim" aria-label="Dismiss navigation" onClick={() => setMenu(false)} />}

      <div className="fb-main">
        <header className="fb-topbar">
          <div className="fb-crumb"><button className="fb-menu-open fb-icon-button" aria-label="Open navigation" aria-expanded={menu} aria-controls="workspace-nav" onClick={() => setMenu(true)}><Menu size={21} /></button><span>Workspace</span><span aria-hidden="true">/</span><strong>{currentPage}</strong></div>
          <div className="fb-top-actions"><ThemeToggle /><button className="fb-button fb-primary" onClick={() => setAdding(true)} disabled={data.loading || Boolean(data.error)}><Plus size={17} />Add expense</button></div>
        </header>

        <main id="workspace" className="fb-workspace" tabIndex={-1}>
          {data.error ? <section className="fb-panel fb-empty" role="alert"><h1>Couldn’t load your workspace</h1><p>Check your connection and try again.</p><button className="fb-button fb-secondary" onClick={() => location.reload()}>Reload workspace</button></section> :
            data.loading ? <div className="fb-loading" role="status">Loading your workspace…</div> : (
              <Suspense fallback={<div className="fb-loading" role="status">Loading {currentPage}…</div>}>
                {page === 'dashboard' && <Overview expenses={data.expenses} budgets={data.budgets} categories={getAllCategories(data.customCategories)} month={month} onMonthChange={setMonth} onOpenLedger={() => { setRange(monthRange(month)); navigate('expenses'); }} onOpenBudgets={() => navigate('budgets')} onAddExpense={() => setAdding(true)} />}
                {page === 'expenses' && <Ledger expenses={data.expenses} people={people} range={range} onRangeChange={setRange} onEdit={setEditing} onDelete={deleteExpense} />}
                {page === 'budgets' && <BudgetManager budgets={data.budgets} expenses={data.expenses} onAddBudget={data.addBudget} onDeleteBudget={data.deleteBudget} onUpdateBudget={data.updateBudget} customCategories={data.customCategories} budgetTemplates={data.budgetTemplates} publicBudgetTemplates={data.publicBudgetTemplates} onAdoptBudgetTemplate={data.adoptBudgetTemplate} onAddBudgetTemplate={data.addBudgetTemplate} onUpdateBudgetTemplate={data.updateBudgetTemplate} onDeleteBudgetTemplate={data.deleteBudgetTemplate} />}
                {page === 'templates' && <RecurringTemplates onAddExpense={addExpense} onAddTemplate={data.addTemplate} onDeleteTemplate={data.deleteTemplate} customCategories={data.customCategories} customPeople={data.customPeople} publicPeople={data.publicPeople} />}
                {page === 'categories' && <CategoryManager customCategories={data.customCategories} publicCategories={data.publicCategories} onAddCategory={data.addCustomCategory} onUpdateCategory={data.updateCustomCategory} onDeleteCategory={data.deleteCustomCategory} onAdoptCategory={data.adoptCategory} />}
                {page === 'people' && <PeopleManager user={user} customPeople={data.customPeople} publicPeople={data.publicPeople} onAddPerson={data.addPerson} onUpdatePerson={data.updatePerson} onDeletePerson={data.deletePerson} onAdoptPerson={data.adoptPerson} />}
                {page === 'explorer' && <MetricsExplorer expenses={periodExpenses(data.expenses, range.from, range.to)} budgets={data.budgets} customCategories={data.customCategories} customPeople={data.customPeople} publicPeople={data.publicPeople} />}
                {page === 'ai-chat' && <AIChatPage />}
              </Suspense>
            )}
          <footer className="fb-footer"><span>FinBuddy {APP_VERSION_DISPLAY}</span><a href="/docs/privacy-policy.html">Privacy</a><a href="/docs/terms-and-conditions.html">Terms</a><UsageAnalytics /></footer>
        </main>
      </div>

      <nav className="fb-bottom-nav" aria-label="Quick navigation">
        {pages.slice(0, 3).map(({ id, label, icon: Icon }) => <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={20} />{label}</button>)}
        <button aria-expanded={menu} aria-controls="workspace-nav" onClick={() => setMenu(!menu)}><Menu size={20} />More</button>
      </nav>

      {adding && !data.loading && !data.error && <AddExpenseModal isOpen onClose={() => setAdding(false)} onAddExpense={addExpense} customCategories={data.customCategories} customPeople={data.customPeople} publicPeople={data.publicPeople} />}
      {editing && <EditExpenseModal expense={editing} isOpen onClose={() => setEditing(null)} onUpdate={data.updateExpense} customCategories={data.customCategories} customPeople={data.customPeople} publicPeople={data.publicPeople} />}
    </div>
  );
}

function AppContent() {
  const { user, loading, redirectError } = useAuth();
  if (loading) return <div className="fb-loading fb-fullscreen" role="status">Opening FinBuddy…</div>;
  return user ? <Workspace key={user.uid} user={user} /> : <LoginPage redirectError={redirectError} />;
}

export default function App() {
  return <AuthProvider><AppContent /><Toaster position="top-right" /></AuthProvider>;
}
