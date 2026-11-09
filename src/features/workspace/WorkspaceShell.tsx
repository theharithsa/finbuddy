import { Fragment, useState, type ReactNode, type RefObject } from 'react';
import { CalendarDays, ChartNoAxesCombined, ChevronRight, CircleHelp, House, Landmark, LayoutDashboard, LogOut, Menu, Plus, ReceiptText, Repeat2, Settings, Shapes, Sparkles, Users, Wallet } from '@/components/brand/Icons';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AccountAvatar } from '@/features/account/AccountAvatar';
import { UsageAnalytics } from '@/features/account/UsageAnalytics';
import { Wordmark } from '@/components/brand/BrandMark';
import { APP_VERSION_DISPLAY } from '@/lib/version';

const mainPages = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'savings', label: 'Savings', icon: Landmark },
] as const;

const moneyPages = [
  { id: 'bills', label: 'Bills & EMIs', description: 'See payments still due', icon: CalendarDays },
  { id: 'budgets', label: 'Budgets', description: 'Set category spending limits', icon: Wallet },
  { id: 'dashboard', label: 'Overview', description: 'Review your spending by month', icon: LayoutDashboard },
  { id: 'templates', label: 'Recurring', description: 'Reuse expenses you log regularly', icon: Repeat2 },
  { id: 'explorer', label: 'Metrics Explorer', description: 'Coming soon', icon: ChartNoAxesCombined },
] as const;

const personalPages = [
  { id: 'settings', label: 'Settings', description: 'Change font, colors, and display mode', icon: Settings },
  { id: 'categories', label: 'Categories', description: 'Organize where your money goes', icon: Shapes },
  { id: 'people', label: 'People', description: 'Track spending for other people', icon: Users },
  { id: 'ai-chat', label: 'KautilyaAI', description: 'Coming soon', icon: Sparkles },
] as const;

const morePages = [...moneyPages, ...personalPages];
const moreGroups = [
  { label: 'Money tools', pages: moneyPages },
  { label: 'Your FinBuddy', pages: personalPages },
];

export type WorkspacePage = (typeof mainPages)[number]['id'] | (typeof morePages)[number]['id'];

const demoDestinations = new Set<WorkspacePage>(['bills', 'dashboard', 'settings', 'explorer']);

interface WorkspaceShellProps {
  page: WorkspacePage;
  mainRef: RefObject<HTMLElement | null>;
  onNavigate: (page: WorkspacePage) => void;
  onAddExpense?: () => void;
  addExpenseDisabled?: boolean;
  account?: { name: string; photoUrl?: string; onSignOut: () => void; signingOut: boolean };
  children: ReactNode;
}

export function WorkspaceShell({ page, mainRef, onNavigate, onAddExpense, addExpenseDisabled, account, children }: WorkspaceShellProps) {
  const [menu, setMenu] = useState(false);
  const moreSelected = morePages.some(({ id }) => page === id);

  function navigate(next: WorkspacePage) {
    setMenu(false);
    onNavigate(next);
  }

  return (
    <div className="m3-shell">
      <a className="m3-skip" href="#workspace">Skip to workspace</a>
      <header className="m3-app-bar">
        <div className="m3-app-bar-inner">
          <button className="m3-brand-link" type="button" aria-label="FinBuddy home" onClick={() => navigate('home')}><Wordmark /></button>
          <nav className="m3-navigation" aria-label="Workspace">
            {mainPages.map(({ id, label, icon: Icon }) => (
              <Fragment key={id}>
                {id === 'savings' && onAddExpense && (
                  <button className="m3-destination m3-mobile-expense" type="button" aria-label="Add expense" onClick={onAddExpense} disabled={addExpenseDisabled}>
                    <span className="m3-destination-indicator"><Plus size={22} /></span><span>Add</span>
                  </button>
                )}
                <button type="button" className="m3-destination" aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>
                  <span className="m3-destination-indicator"><Icon size={22} /></span><span>{label}</span>
                </button>
              </Fragment>
            ))}
            <Dialog open={menu} onOpenChange={setMenu}>
              <DialogTrigger asChild>
                <button type="button" className="m3-destination" data-selected={moreSelected || undefined}><span className="m3-destination-indicator"><Menu size={22} /></span><span>More</span></button>
              </DialogTrigger>
              <DialogContent className="m3-drawer">
                <DialogHeader><DialogTitle>More</DialogTitle><DialogDescription>Find bills, spending tools, and your settings.</DialogDescription></DialogHeader>
                {account && <div className="m3-drawer-account">
                  <AccountAvatar name={account.name} photoUrl={account.photoUrl} />
                  <div><strong title={account.name}>{account.name}</strong><small>FinBuddy account</small></div>
                </div>}
                <nav className="m3-drawer-list" aria-label="More destinations">
                  {moreGroups.map(({ label, pages }) => (
                    <div className="m3-drawer-group" role="group" aria-label={label} key={label}>
                      <p>{label}</p>
                      {pages.filter(({ id }) => account || demoDestinations.has(id)).map(({ id, label, description, icon: Icon }) => (
                        <button type="button" key={id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>
                          <Icon size={21} /><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={18} />
                        </button>
                      ))}
                    </div>
                  ))}
                  <a href="/docs/"><CircleHelp size={21} /><span><strong>Help center</strong></span><ChevronRight size={18} /></a>
                </nav>
                {account && <div className="m3-drawer-footer">
                  <UsageAnalytics />
                  <Button variant="outline" onClick={account.onSignOut} disabled={account.signingOut}><LogOut size={18} />{account.signingOut ? 'Signing out…' : 'Sign out'}</Button>
                </div>}
              </DialogContent>
            </Dialog>
          </nav>
          <div className="m3-app-actions">
            <ThemeToggle />
            {account && <AccountAvatar name={account.name} photoUrl={account.photoUrl} />}
            {onAddExpense && <button className="m3-fab" type="button" onClick={onAddExpense} disabled={addExpenseDisabled}>
              <Plus size={21} /> <span>Add expense</span>
            </button>}
          </div>
        </div>
      </header>

      <main id="workspace" className="m3-workspace" tabIndex={-1} ref={mainRef}>
        {!account && <div className="m3-demo-banner">
          <div><strong>FinBuddy demo</strong><span>Sample household data</span></div>
          <Button asChild variant="outline" size="sm"><a href="/">Back to sign in</a></Button>
        </div>}
        <div key={page} className="m3-route">{children}</div>
        <footer className="m3-footer"><span>FinBuddy {APP_VERSION_DISPLAY}</span><a href="/docs/privacy-policy.html">Privacy</a><a href="/docs/terms-and-conditions.html">Terms</a></footer>
      </main>
    </div>
  );
}
